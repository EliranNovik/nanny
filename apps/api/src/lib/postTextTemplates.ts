export type PostTextPostType = "request" | "offer" | "event" | "community";

export type PostTextInput = {
  postType?: PostTextPostType;
  category?: string;
  otherType?: string;
  location?: string;
  whenNeeded?: string;
  duration?: string;
  childrenCount?: number;
  childrenAges?: number[];
  budget?: string;
  extraNotes?: string;
  service?: string;
  rate?: string;
  event_name?: string;
  date_time?: string;
  title?: string;
};

export type GeneratedPostCopy = {
  title: string;
  short_text: string;
  feed_preview: string;
  tags: string[];
};

type RequestCategory =
  | "nanny"
  | "cleaning"
  | "cooking"
  | "delivery"
  | "shopping"
  | "dog_walking"
  | "elderly_help"
  | "general_help";

const FALLBACK_TITLE = "Need help";
const FALLBACK_SHORT_TEXT = "Looking for someone available to help.";
const FALLBACK_FEED_PREVIEW = "Help needed.";

function humanizeSnake(value: string): string {
  return value.trim().replace(/(\d)_(\d)/g, "$1-$2").replace(/_/g, " ");
}

function titleCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function clampCopy(raw: GeneratedPostCopy): GeneratedPostCopy {
  const title = raw.title.trim().slice(0, 70) || FALLBACK_TITLE;
  const short_text = raw.short_text.trim().slice(0, 300) || FALLBACK_SHORT_TEXT;
  const feed_preview = raw.feed_preview.trim().slice(0, 120) || FALLBACK_FEED_PREVIEW;
  const tags = raw.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8);
  return { title, short_text, feed_preview, tags };
}

function normalizeCategory(category?: string, otherType?: string): RequestCategory {
  const c = (category ?? "").toLowerCase().replace(/-/g, "_");
  if (c === "pickup_delivery" || c === "pick_up" || c === "pickup") return "delivery";
  if (c === "other_help") {
    const ot = (otherType ?? "").toLowerCase();
    if (ot === "caregiving" || ot === "elderly_help" || ot === "elderly") return "elderly_help";
    if (ot === "dog_walking" || ot === "dog_walk") return "dog_walking";
    if (ot === "shopping" || ot === "grocery") return "shopping";
    return "general_help";
  }
  if (c === "babysitter" || c === "babysitting") return "nanny";
  if (
    c === "nanny" ||
    c === "cleaning" ||
    c === "cooking" ||
    c === "delivery" ||
    c === "shopping" ||
    c === "dog_walking" ||
    c === "elderly_help" ||
    c === "general_help"
  ) {
    return c;
  }
  return "general_help";
}

function categoryDisplayLabel(category: RequestCategory): string {
  const labels: Record<RequestCategory, string> = {
    nanny: "Nanny",
    cleaning: "Cleaning",
    cooking: "Cooking",
    delivery: "Pick up & delivery",
    shopping: "Shopping",
    dog_walking: "Dog walking",
    elderly_help: "Elderly care",
    general_help: "Help",
  };
  return labels[category];
}

function roleNoun(category: RequestCategory): string {
  const nouns: Record<RequestCategory, string> = {
    nanny: "babysitter",
    cleaning: "cleaner",
    cooking: "cook",
    delivery: "delivery helper",
    shopping: "shopper",
    dog_walking: "dog walker",
    elderly_help: "caregiver",
    general_help: "helper",
  };
  return nouns[category];
}

function kidsText(count?: number): string {
  if (count == null || count <= 0) return "children";
  return `${count} ${count === 1 ? "child" : "children"}`;
}

function kidsTag(count?: number): string | null {
  if (count == null || count <= 0) return null;
  return `${count} ${count === 1 ? "kid" : "kids"}`;
}

function agesText(ages?: number[]): string {
  if (!ages?.length) return "";
  if (ages.length === 1) return `, age ${ages[0]}`;
  if (ages.length === 2) return `, ages ${ages[0]} and ${ages[1]}`;
  const last = ages[ages.length - 1];
  return `, ages ${ages.slice(0, -1).join(", ")}, and ${last}`;
}

function locationSuffix(location?: string): string {
  return location?.trim() ? ` in ${location.trim()}` : "";
}

function timePrefix(whenNeeded?: string): string {
  return whenNeeded?.trim() ? ` ${whenNeeded.trim()}` : "";
}

function durationSentence(duration?: string): string {
  const d = duration?.trim();
  return d ? ` Duration: ${humanizeSnake(d)}.` : "";
}

function notesSentence(extraNotes?: string): string {
  const n = extraNotes?.trim();
  return n ? ` ${n}` : "";
}

function budgetSentence(budget?: string): string {
  const b = budget?.trim();
  return b ? ` Budget: ${b}.` : "";
}

function buildRequestTags(category: RequestCategory, data: PostTextInput): string[] {
  const kids = kidsTag(data.childrenCount);
  return [
    categoryDisplayLabel(category),
    data.whenNeeded ? titleCase(data.whenNeeded) : null,
    kids,
    data.location?.trim() || null,
  ].filter((t): t is string => Boolean(t));
}

function generateNannyText(data: PostTextInput): GeneratedPostCopy {
  const kids = kidsText(data.childrenCount);
  const ages = agesText(data.childrenAges);
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);

  return clampCopy({
    title: `Need a babysitter${time}${loc}`,
    short_text: `Looking for a responsible babysitter${time} for ${kids}${ages}.${durationSentence(data.duration)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Babysitter needed${time} for ${kidsTag(data.childrenCount) ?? "kids"}${loc}.`,
    tags: buildRequestTags("nanny", data),
  });
}

function generateCleaningText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need a cleaner${time}${loc}`,
    short_text: `Looking for a reliable cleaner${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Cleaner needed${time}${loc}.`,
    tags: buildRequestTags("cleaning", data),
  });
}

function generateCookingText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need a cook${time}${loc}`,
    short_text: `Looking for someone to cook${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Cook needed${time}${loc}.`,
    tags: buildRequestTags("cooking", data),
  });
}

function generateDeliveryText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need pickup & delivery${time}${loc}`,
    short_text: `Looking for help with pickup and delivery${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Pickup & delivery needed${time}${loc}.`,
    tags: buildRequestTags("delivery", data),
  });
}

function generateShoppingText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need shopping help${time}${loc}`,
    short_text: `Looking for someone to help with shopping${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Shopping help needed${time}${loc}.`,
    tags: buildRequestTags("shopping", data),
  });
}

function generateDogWalkingText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need a dog walker${time}${loc}`,
    short_text: `Looking for a dog walker${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Dog walker needed${time}${loc}.`,
    tags: buildRequestTags("dog_walking", data),
  });
}

function generateElderlyHelpText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  return clampCopy({
    title: `Need elderly care${time}${loc}`,
    short_text: `Looking for a caring helper for an older adult${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Elderly care needed${time}${loc}.`,
    tags: buildRequestTags("elderly_help", data),
  });
}

function generateGeneralHelpText(data: PostTextInput): GeneratedPostCopy {
  const loc = locationSuffix(data.location);
  const time = timePrefix(data.whenNeeded);
  const role = roleNoun("general_help");
  return clampCopy({
    title: `Need a ${role}${time}${loc}`,
    short_text: `Looking for someone available to help${time}${loc}.${durationSentence(data.duration)}${budgetSentence(data.budget)}${notesSentence(data.extraNotes)}`,
    feed_preview: `Help needed${time}${loc}.`,
    tags: buildRequestTags("general_help", data),
  });
}

function generateOfferText(data: PostTextInput): GeneratedPostCopy {
  const category = normalizeCategory(data.category ?? data.service);
  const label = categoryDisplayLabel(category);
  const loc = locationSuffix(data.location);
  const rate = data.rate?.trim() || data.budget?.trim();
  return clampCopy({
    title: `Offering ${label.toLowerCase()}${loc}`,
    short_text: `I'm offering ${label.toLowerCase()} services${loc}.${rate ? ` From ${rate}.` : ""}${notesSentence(data.extraNotes)}`,
    feed_preview: `${label} offered${loc}.`,
    tags: [label, data.location?.trim() || null, rate ? titleCase(rate) : null].filter(
      (t): t is string => Boolean(t),
    ),
  });
}

function generateEventText(data: PostTextInput): GeneratedPostCopy {
  const name = data.event_name?.trim() || "Community event";
  const when = data.date_time?.trim() || data.whenNeeded?.trim();
  const loc = data.location?.trim();
  return clampCopy({
    title: name.slice(0, 70),
    short_text: [name, when, loc ? `Location: ${loc}` : null, data.extraNotes?.trim()]
      .filter(Boolean)
      .join(". ")
      .slice(0, 300),
    feed_preview: name.slice(0, 120),
    tags: [name, when ? titleCase(when) : null, loc].filter((t): t is string => Boolean(t)),
  });
}

function generateCommunityText(data: PostTextInput): GeneratedPostCopy {
  const headline = data.title?.trim() || "Community post";
  const body = data.extraNotes?.trim() || headline;
  return clampCopy({
    title: headline.slice(0, 70),
    short_text: body.slice(0, 300),
    feed_preview: headline.slice(0, 120),
    tags: [headline].filter(Boolean),
  });
}

export function generatePostText(data: PostTextInput): GeneratedPostCopy {
  const postType = data.postType ?? "request";
  if (postType === "offer") return generateOfferText(data);
  if (postType === "event") return generateEventText(data);
  if (postType === "community") return generateCommunityText(data);

  const category = normalizeCategory(data.category, data.otherType);
  switch (category) {
    case "nanny":
      return generateNannyText(data);
    case "cleaning":
      return generateCleaningText(data);
    case "cooking":
      return generateCookingText(data);
    case "delivery":
      return generateDeliveryText(data);
    case "shopping":
      return generateShoppingText(data);
    case "dog_walking":
      return generateDogWalkingText(data);
    case "elderly_help":
      return generateElderlyHelpText(data);
    default:
      return generateGeneralHelpText(data);
  }
}

const WHEN_LABELS: Record<string, string> = {
  now: "Now",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  custom: "Custom",
};

function formatJobWhen(job: Record<string, unknown>): string | undefined {
  const timeframe = typeof job.when_timeframe === "string" ? job.when_timeframe : undefined;
  if (!timeframe) return undefined;
  if (timeframe === "custom" && typeof job.custom_when_at === "string") {
    const parsed = new Date(job.custom_when_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return WHEN_LABELS[timeframe] ?? humanizeSnake(timeframe);
}

function parseKidsCount(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const match = raw.match(/^(\d+)/);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function formatJobBudget(job: Record<string, unknown>): string | undefined {
  const min = typeof job.budget_min === "number" ? job.budget_min : null;
  const max = typeof job.budget_max === "number" ? job.budget_max : null;
  if (min != null && max != null && max !== min) return `₪${min}–${max}`;
  if (min != null) return `₪${min}`;
  if (max != null) return `₪${max}`;
  return undefined;
}

export function buildPostTextInputFromJob(job: Record<string, unknown>): PostTextInput {
  const sd =
    job.service_details && typeof job.service_details === "object"
      ? (job.service_details as Record<string, unknown>)
      : {};

  return {
    postType: "request",
    category:
      typeof job.service_type === "string"
        ? job.service_type
        : typeof sd.category === "string"
          ? sd.category
          : undefined,
    otherType: typeof sd.other_type === "string" ? sd.other_type : undefined,
    location: typeof job.location_city === "string" ? job.location_city : undefined,
    whenNeeded: formatJobWhen(job),
    duration: typeof job.time_duration === "string" ? job.time_duration : undefined,
    childrenCount: parseKidsCount(sd.kids_count),
    budget: formatJobBudget(job),
    extraNotes: typeof job.notes === "string" ? job.notes : undefined,
  };
}
