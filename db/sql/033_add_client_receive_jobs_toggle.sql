-- Add is_available_for_jobs to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available_for_jobs BOOLEAN DEFAULT false;

-- Create function to create or manage default freelancer profile for clients
CREATE OR REPLACE FUNCTION handle_client_availability() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_available_for_jobs = true THEN
        -- Check if freelancer profile already exists
        IF NOT EXISTS (SELECT 1 FROM public.freelancer_profiles WHERE id = NEW.id) THEN
            -- Create a minimal active freelancer profile
            INSERT INTO public.freelancer_profiles (
                id,
                has_first_aid,
                special_needs_experience,
                newborn_experience,
                max_children,
                available_now,
                hourly_rate_min,
                hourly_rate_max,
                languages
            ) VALUES (
                NEW.id,
                false,
                false,
                false,
                4,
                true,
                50,
                150,
                '[]'::jsonb
            );
        ELSE
            -- Just ensure they are marked available
            UPDATE public.freelancer_profiles
            SET available_now = true
            WHERE id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profile updates
DROP TRIGGER IF EXISTS on_client_availability_update ON public.profiles;
CREATE TRIGGER on_client_availability_update
    AFTER UPDATE OF is_available_for_jobs ON public.profiles
    FOR EACH ROW
    WHEN (OLD.is_available_for_jobs IS DISTINCT FROM NEW.is_available_for_jobs AND NEW.is_available_for_jobs = true)
    EXECUTE FUNCTION handle_client_availability();
