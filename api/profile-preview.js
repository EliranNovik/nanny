const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key || !id) return res.status(404).send("Not found");

  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=full_name,photo_url,bio,categories&limit=1`;
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const [profile] = response.ok ? await response.json() : [];
  if (!profile) return res.status(404).send("Not found");

  const name = profile.full_name?.trim() || "Tebnu member";
  const categories = Array.isArray(profile.categories)
    ? profile.categories.map((item) => String(item).replace(/_/g, " ")).join(" · ")
    : "";
  const description = [profile.bio?.trim(), categories].filter(Boolean).join(" — ");
  const canonical = `https://www.tebnu.com/profile/${encodeURIComponent(id)}`;
  const image = profile.photo_url || "https://www.tebnu.com/brand-mark.png";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  res.send(`<!doctype html><html><head>
<title>${escapeHtml(name)} on Tebnu</title>
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Tebnu">
<meta property="og:title" content="${escapeHtml(name)} on Tebnu">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(name)} on Tebnu">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="canonical" href="${canonical}">
<meta http-equiv="refresh" content="0;url=${canonical}">
</head><body><a href="${canonical}">View ${escapeHtml(name)} on Tebnu</a></body></html>`);
}
