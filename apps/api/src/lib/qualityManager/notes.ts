import { supabaseAdmin } from "../../supabase";

export type QualityNotes = {
  standards: string[];
  categories: string[];
};

/** Admin notes for the quality manager. Missing table means the built-in standards are used. */
export async function loadQualityNotes(): Promise<QualityNotes> {
  const { data, error } = await supabaseAdmin
    .from("quality_manager_notes")
    .select("kind, title, body")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return { standards: [], categories: [] };

  const standards: string[] = [];
  const categories: string[] = [];
  for (const row of data) {
    const title = String(row.title ?? "").trim();
    const body = String(row.body ?? "").trim();
    const line = [title, body].filter(Boolean).join(": ");
    if (!line) continue;
    if (row.kind === "category") categories.push(line);
    else standards.push(line);
  }
  return { standards, categories };
}
