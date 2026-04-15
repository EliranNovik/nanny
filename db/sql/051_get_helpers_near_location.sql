CREATE OR REPLACE FUNCTION get_helpers_near_location(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision,
  search_query text DEFAULT '',
  viewer_city_norm text DEFAULT '',
  geocode_matched_place boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  full_name text,
  photo_url text,
  city text,
  location_lat double precision,
  location_lng double precision,
  service_radius double precision,
  average_rating double precision,
  total_ratings integer,
  role text,
  is_available_for_jobs boolean,
  freelancer_profiles jsonb,
  distance_km double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH profiles_with_dist AS (
    SELECT
      p.id,
      p.full_name,
      p.photo_url,
      p.city,
      p.location_lat,
      p.location_lng,
      p.service_radius,
      p.average_rating,
      p.total_ratings,
      p.role,
      p.is_available_for_jobs,
      jsonb_build_object(
        'hourly_rate_min', fp.hourly_rate_min,
        'hourly_rate_max', fp.hourly_rate_max,
        'bio', fp.bio,
        'available_now', fp.available_now
      ) as freelancer_profiles,
      -- Haversine formula (6371 km)
      CASE 
        WHEN p.location_lat IS NOT NULL AND p.location_lng IS NOT NULL THEN
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(search_lat)) * cos(radians(p.location_lat)) *
              cos(radians(p.location_lng) - radians(search_lng)) +
              sin(radians(search_lat)) * sin(radians(p.location_lat))
            ))
          )
        ELSE NULL
      END AS distance_km
    FROM profiles p
    LEFT JOIN freelancer_profiles fp ON p.id = fp.user_id
    WHERE p.role = 'freelancer' OR (p.role = 'client' AND p.is_available_for_jobs = true)
  )
  SELECT 
    pd.id,
    pd.full_name,
    pd.photo_url,
    pd.city,
    pd.location_lat,
    pd.location_lng,
    pd.service_radius,
    pd.average_rating,
    pd.total_ratings,
    pd.role,
    pd.is_available_for_jobs,
    pd.freelancer_profiles,
    pd.distance_km
  FROM profiles_with_dist pd
  WHERE 
    CASE 
      WHEN pd.distance_km IS NOT NULL THEN
        pd.distance_km <= radius_km
        AND (
          search_query = '' 
          OR geocode_matched_place = true
          OR lower(pd.full_name) LIKE '%' || lower(search_query) || '%'
          OR lower(pd.city) LIKE '%' || lower(search_query) || '%'
        )
      ELSE
        (
          search_query != '' 
          AND (
            lower(pd.full_name) LIKE '%' || lower(search_query) || '%'
            OR lower(pd.city) LIKE '%' || lower(search_query) || '%'
          )
        )
        OR 
        (
          search_query = ''
          AND viewer_city_norm != ''
          AND lower(regexp_replace(trim(pd.city), '\s+', ' ', 'g')) = viewer_city_norm
        )
    END
  ORDER BY 
    CASE WHEN pd.distance_km IS NULL THEN 1 ELSE 0 END ASC,
    pd.distance_km ASC
  LIMIT 500;
END;
$$;
