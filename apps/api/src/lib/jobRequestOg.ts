import { supabaseAdmin } from "../supabase";
import {
  brandMarkImageUrl,
  buildShareOgHtml,
  parseGeneratedCopy,
  parseShareUuid,
  resolveShareDescription,
  resolveShareTitle,
  type ShareOgMeta,
  webAppOrigin,
} from "./shareOgCommon";

export { parseShareUuid as parseJobRequestShareId } from "./shareOgCommon";

export async function fetchJobRequestOgMeta(
  requestId: string,
): Promise<ShareOgMeta | null> {
  const cleanId = parseShareUuid(requestId);
  if (!cleanId) return null;

  const { data: row, error } = await supabaseAdmin
    .from("job_requests")
    .select(
      "id, client_id, service_type, location_city, created_at, when_timeframe, time_duration, budget_min, budget_max, budget_rate_type, notes, ai_generated_copy, status",
    )
    .eq("id", cleanId)
    .maybeSingle();

  if (error || !row) return null;

  const { data: client } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", row.client_id as string)
    .maybeSingle();

  const authorName = (client?.full_name as string | null)?.trim() || "Member";
  const generatedCopy = parseGeneratedCopy(row.ai_generated_copy);
  const title = resolveShareTitle({
    generatedCopy,
    postTypeId: "request_help",
    serviceType: row.service_type as string | null,
    caption: row.notes as string | null,
  });
  const description = resolveShareDescription({
    generatedCopy,
    caption: row.notes as string | null,
    title,
  });

  const origin = webAppOrigin();
  const imageUrl = brandMarkImageUrl(origin);
  const canonicalUrl = origin
    ? `${origin}/requests/${encodeURIComponent(cleanId)}`
    : `/requests/${encodeURIComponent(cleanId)}`;

  return {
    id: cleanId,
    title,
    description,
    authorName,
    imageUrl,
    canonicalUrl,
  };
}

export function buildJobRequestOgHtml(meta: ShareOgMeta): string {
  return buildShareOgHtml(meta);
}
