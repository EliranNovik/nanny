const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);

async function run() {
  const userId = '950a6c96-0f47-4cc6-a427-79fa39ec541a';
  const nowIso = new Date().toISOString();
  console.log('Current ISO time:', nowIso);

  const { data, error } = await supabase
    .from("freelancer_profiles")
    .select(
      `
      user_id,
      bio,
      live_until,
      live_categories,
      live_can_start_in,
      profiles!inner (
        id,
        full_name,
        photo_url,
        city,
        location_lat,
        location_lng,
        average_rating,
        total_ratings,
        is_verified
      )
    `
    )
    .not("live_until", "is", null)
    .gt("live_until", nowIso)
    .limit(300);

  if (error) {
    console.error('Error running useDiscoverLiveAvatars query:', error);
    return;
  }

  console.log('Total live profiles returned:', data.length);
  const found = data.find(r => r.user_id === userId);
  if (found) {
    console.log('✓ Found user in query result:', JSON.stringify(found, null, 2));
  } else {
    console.log('✗ User NOT found in query result!');
    // Let's check why: is live_until less than nowIso?
    const { data: raw } = await supabase
      .from("freelancer_profiles")
      .select("live_until")
      .eq("user_id", userId)
      .maybeSingle();
    console.log('User raw live_until:', raw ? raw.live_until : 'no record');
  }
}

run();
