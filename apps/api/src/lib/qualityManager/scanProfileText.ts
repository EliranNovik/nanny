import { createHash } from "node:crypto";
import { supabaseAdmin } from "../../supabase";
import { reviewProfileText } from "./reviewPost";

const MAX_EACH = 3;

type BioRow = { id: string; bio: string | null; is_admin?: boolean | null };
type ReviewRow = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  review_text: string | null;
};

const failures = new Map<string, number>();

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Score profile bios and written reviews with the same quality manager as chats. */
export async function scanProfileTexts(adminIds: Set<string>): Promise<void> {
  await scanBios(adminIds);
  await scanReviews(adminIds);
}

async function scanBios(adminIds: Set<string>): Promise<void> {
  const [{ data: profiles, error: profileErr }, { data: helpers, error: helperErr }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, bio, is_admin, updated_at")
      .not("bio", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("freelancer_profiles")
      .select("user_id, bio, updated_at")
      .not("bio", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);
  if (profileErr) throw profileErr;
  if (helperErr) throw helperErr;

  const byUser = new Map<string, { text: string; admin: boolean }>();
  for (const row of (profiles ?? []) as BioRow[]) {
    const text = (row.bio ?? "").trim();
    if (text.length < 8) continue;
    byUser.set(row.id, { text, admin: row.is_admin === true || adminIds.has(row.id) });
  }
  const helperIds = ((helpers ?? []) as Array<{ user_id: string; bio: string | null }>)
    .map((row) => row.user_id)
    .filter((id) => !byUser.has(id));
  const adminById = new Map<string, boolean>();
  if (helperIds.length > 0) {
    const { data: people } = await supabaseAdmin.from("profiles").select("id, is_admin").in("id", helperIds);
    for (const person of people ?? []) adminById.set(person.id as string, person.is_admin === true);
  }
  for (const row of (helpers ?? []) as Array<{ user_id: string; bio: string | null }>) {
    const extra = (row.bio ?? "").trim();
    if (extra.length < 8) continue;
    const current = byUser.get(row.user_id);
    const text = current ? `${current.text}\n\n${extra}` : extra;
    byUser.set(row.user_id, {
      text,
      admin: current?.admin || adminById.get(row.user_id) === true || adminIds.has(row.user_id),
    });
  }

  const pending = [...byUser.entries()].filter(([, row]) => !row.admin);
  await reviewPending(
    "bio",
    pending.map(([id, row]) => ({
      subjectId: id,
      userId: id,
      aboutUserId: null,
      reviewId: null,
      text: row.text,
    })),
  );
}

async function scanReviews(adminIds: Set<string>): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("job_reviews")
    .select("id, reviewer_id, reviewee_id, review_text, created_at")
    .not("review_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  const rows = ((data ?? []) as ReviewRow[]).filter((row) => (row.review_text ?? "").trim().length >= 8);
  const authorIds = [...new Set(rows.map((row) => row.reviewer_id))];
  const adminAuthors = new Set<string>();
  if (authorIds.length > 0) {
    const { data: people } = await supabaseAdmin.from("profiles").select("id, is_admin").in("id", authorIds);
    for (const person of people ?? []) {
      if (person.is_admin === true) adminAuthors.add(person.id as string);
    }
  }
  await reviewPending(
    "review",
    rows
      .filter((row) => !adminIds.has(row.reviewer_id) && !adminAuthors.has(row.reviewer_id))
      .map((row) => ({
        subjectId: row.id,
        userId: row.reviewer_id,
        aboutUserId: row.reviewee_id,
        reviewId: row.id,
        text: (row.review_text ?? "").trim(),
      })),
  );
}

type PendingText = {
  subjectId: string;
  userId: string;
  aboutUserId: string | null;
  reviewId: string | null;
  text: string;
};

async function reviewPending(kind: "bio" | "review", rows: PendingText[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.subjectId);
  const { data: scans, error } = await supabaseAdmin
    .from("quality_text_scans")
    .select("subject_id, content_hash")
    .eq("kind", kind)
    .in("subject_id", ids);
  if (error) throw error;
  const seen = new Map((scans ?? []).map((row) => [row.subject_id as string, row.content_hash as string]));
  const pending = rows
    .filter((row) => seen.get(row.subjectId) !== digest(row.text))
    .filter((row) => (failures.get(`${kind}:${row.subjectId}`) ?? 0) < 2)
    .slice(0, MAX_EACH);

  for (const row of pending) {
    const key = `${kind}:${row.subjectId}`;
    try {
      await reviewOne(kind, row);
      failures.delete(key);
    } catch (err) {
      const attempts = (failures.get(key) ?? 0) + 1;
      failures.set(key, attempts);
      if (attempts >= 2) await markScanned(kind, row.subjectId, digest(row.text));
      console.error("[QualityText] Review failed:", err instanceof Error ? err.message : err);
    }
  }
}

async function reviewOne(kind: "bio" | "review", row: PendingText): Promise<void> {
  const hash = digest(row.text);
  const review = await reviewProfileText({ kind, text: row.text });
  if (review.decision === "allow" || review.reasons.length === 0) {
    await markScanned(kind, row.subjectId, hash);
    return;
  }
  const saved = {
    user_id: row.userId,
    about_user_id: row.aboutUserId,
    review_id: row.reviewId,
    kind,
    summary: review.summary || review.reasons[0]?.detail || "Flagged",
    excerpt: row.text.slice(0, 280),
    reasons: review.reasons,
    outcome: review.decision,
    dismissed_at: null,
  };
  let openQuery = supabaseAdmin
    .from("quality_profile_flags")
    .select("id")
    .eq("kind", kind)
    .is("dismissed_at", null);
  openQuery = kind === "review" && row.reviewId
    ? openQuery.eq("review_id", row.reviewId)
    : openQuery.eq("user_id", row.userId);
  const { data: open, error: openErr } = await openQuery.maybeSingle();
  if (openErr) throw openErr;
  const write = open?.id
    ? await supabaseAdmin.from("quality_profile_flags").update(saved).eq("id", open.id)
    : await supabaseAdmin.from("quality_profile_flags").insert(saved);
  if (write.error) throw new Error(write.error.message);
  await markScanned(kind, row.subjectId, hash);
}

async function markScanned(kind: string, subjectId: string, contentHash: string): Promise<void> {
  const { error } = await supabaseAdmin.from("quality_text_scans").upsert({
    kind,
    subject_id: subjectId,
    content_hash: contentHash,
    scanned_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
