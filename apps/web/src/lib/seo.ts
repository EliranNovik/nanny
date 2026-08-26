import { useEffect } from "react";

/** Canonical production origin. Keep sitemap, robots, and page tags on this host. */
export const SITE_ORIGIN = "https://www.tebnu.com";
export const SITE_NAME = "Tebnu";
export const DEFAULT_TITLE = "Tebnu - Your Helper for Home & Life";
export const DEFAULT_DESCRIPTION =
  "Tebnu is a local help app. Find trusted helpers for home, childcare, cooking, errands, and more — or offer your skills nearby.";

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

function setMetaByName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.href = href;
}

export function formatPageTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed === DEFAULT_TITLE) return DEFAULT_TITLE;
  if (trimmed.toLowerCase().includes("tebnu")) return trimmed;
  return `${trimmed} · ${SITE_NAME}`;
}

export function applyPageSeo({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  path: string;
}) {
  const nextTitle = formatPageTitle(title);
  const nextDescription = description?.trim() || DEFAULT_DESCRIPTION;
  const url = absoluteUrl(path);

  document.title = nextTitle;
  setMetaByName("description", nextDescription);
  setMetaByProperty("og:title", nextTitle);
  setMetaByProperty("og:description", nextDescription);
  setMetaByProperty("og:url", url);
  setCanonical(url);
}

export function usePageSeo({
  title,
  description,
  path,
}: {
  title: string;
  description?: string;
  path: string;
}) {
  useEffect(() => {
    applyPageSeo({ title, description, path });
  }, [title, description, path]);
}
