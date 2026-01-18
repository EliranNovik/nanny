import { supabaseAdmin } from "../supabase";

type Job = {
  id: string;
  children_count: number;
  children_age_group: string;
  location_city: string;
  budget_min: number | null;
  budget_max: number | null;
  requirements: string[];
  languages_pref: string[];
};

interface FreelancerProfile {
  has_first_aid: boolean;
  newborn_experience: boolean;
  special_needs_experience: boolean;
  max_children: number;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  languages: string[];
}

interface ProfileWithFreelancer {
  id: string;
  city: string;
  role: string;
  freelancer_profiles: FreelancerProfile;
}

export async function findCandidates(job: Job, limit = 30): Promise<string[]> {
  // Pull freelancers in same city that are available_now and meet requirements.
  // For MVP, city match only. Later add geo radius.
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, city, role, freelancer_profiles!inner(*)")
    .eq("role", "freelancer")
    .eq("city", job.location_city)
    .eq("freelancer_profiles.available_now", true)
    .limit(limit);

  if (error) throw error;

  // Filter in code for requirements and budget.
  const candidates = (data || []).filter((row: ProfileWithFreelancer) => {
    const fp = row.freelancer_profiles;
    if (!fp) {
      console.log("[Match] Skipping", row.id, "- no freelancer_profiles");
      return false;
    }

    // Check max children capacity
    if (job.children_count > fp.max_children) {
      console.log("[Match] Skipping", row.id, "- max_children", fp.max_children, "<", job.children_count);
      return false;
    }

    // Check requirements
    if (job.requirements?.includes("first_aid") && !fp.has_first_aid) {
      console.log("[Match] Skipping", row.id, "- missing first_aid");
      return false;
    }
    if (job.requirements?.includes("newborn") && !fp.newborn_experience) {
      console.log("[Match] Skipping", row.id, "- missing newborn_experience");
      return false;
    }
    if (job.requirements?.includes("special_needs") && !fp.special_needs_experience) {
      console.log("[Match] Skipping", row.id, "- missing special_needs_experience");
      return false;
    }

    // Check budget compatibility
    if (job.budget_min != null && fp.hourly_rate_max != null && fp.hourly_rate_max < job.budget_min) {
      console.log("[Match] Skipping", row.id, "- rate_max", fp.hourly_rate_max, "< budget_min", job.budget_min);
      return false;
    }
    if (job.budget_max != null && fp.hourly_rate_min != null && fp.hourly_rate_min > job.budget_max) {
      console.log("[Match] Skipping", row.id, "- rate_min", fp.hourly_rate_min, "> budget_max", job.budget_max);
      return false;
    }

    // Check language preference
    if (job.languages_pref?.length) {
      const ok = job.languages_pref.some((l) => (fp.languages || []).includes(l));
      if (!ok) {
        console.log("[Match] Skipping", row.id, "- language mismatch");
        return false;
      }
    }

    console.log("[Match] ✓ Candidate matched:", row.id);
    return true;
  });

  console.log("[Match] Final candidates:", candidates.length, "out of", (data || []).length);
  return candidates.map((c: ProfileWithFreelancer) => c.id);
}

