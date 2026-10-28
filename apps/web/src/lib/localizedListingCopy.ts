import type { TFunction } from "i18next";

export type ListingCopyKind = "request" | "offer";

export type ListingCopyInput = {
  kind: ListingCopyKind;
  categoryId?: string | null;
  categoryLabel: string;
  when?: string | null;
  location?: string | null;
  duration?: string | null;
  budget?: string | null;
  notes?: string | null;
};

const WHEN_I18N_KEYS: Record<string, string> = {
  now: "feed.filters.whenNow",
  today: "feed.filters.whenToday",
  tomorrow: "feed.filters.whenTomorrow",
  this_week: "feed.filters.whenThisWeek",
};

const REQUEST_LOOKING_KEYS = new Set([
  "cleaning",
  "cooking",
  "nanny",
  "pickup_delivery",
  "technical_help",
  "other_help",
]);

export function listingWhenLabel(
  t: TFunction,
  timeframe?: string | null,
  customWhen?: string | null,
): string {
  if (!timeframe?.trim()) return "";
  if (timeframe === "custom") return customWhen?.trim() || "";
  const key = WHEN_I18N_KEYS[timeframe];
  return key ? t(key) : timeframe.replace(/_/g, " ");
}

export function listingCityPart(location?: string | null): string {
  const trimmed = location?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

export function listingDurationLabel(
  t: TFunction,
  duration?: string | null,
): string {
  const raw = duration?.trim();
  if (!raw) return "";
  const key = `createJob.timeDuration.${raw}`;
  const localized = t(key, { defaultValue: "" });
  if (localized) return localized;
  return raw.replace(/(\d)_+(\d)/g, "$1-$2").replace(/_/g, " ");
}

export function listingUserNotes(
  caption?: string | null,
  generatedShortText?: string | null,
  generatedTitle?: string | null,
  jobNotes?: string | null,
): string {
  const notes = jobNotes?.trim();
  if (notes) return notes;
  const cap = caption?.trim() ?? "";
  if (!cap) return "";
  const generatedBody = generatedShortText?.trim() ?? "";
  const generatedName = generatedTitle?.trim() ?? "";
  if (cap === generatedBody || cap === generatedName) return "";
  return cap;
}

export function localizedListingTitle(
  t: TFunction,
  input: Pick<ListingCopyInput, "kind" | "categoryLabel" | "when" | "location">,
): string {
  const category = input.categoryLabel.trim();
  const when = input.when?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  if (!category && !location) return "";

  if (input.kind === "offer") {
    if (location) {
      return t("feed.generatedCopy.offerTitleIn", {
        category: category || t("feed.categories.help_request"),
        location,
      });
    }
    return t("feed.generatedCopy.offerTitle", {
      category: category || t("feed.categories.help_request"),
    });
  }

  const cat = category || t("feed.categories.help_request");
  if (when && location) {
    return t("feed.generatedCopy.requestTitleWhenIn", { category: cat, when, location });
  }
  if (when) return t("feed.generatedCopy.requestTitleWhen", { category: cat, when });
  if (location) return t("feed.generatedCopy.requestTitleIn", { category: cat, location });
  return t("feed.generatedCopy.requestTitle", { category: cat });
}

export function localizedListingBody(t: TFunction, input: ListingCopyInput): string {
  const category = input.categoryLabel.trim() || t("feed.categories.help_request");
  const when = input.when?.trim()
    ? t("feed.generatedCopy.whenPart", { when: input.when.trim() })
    : "";
  const location = input.location?.trim()
    ? t("feed.generatedCopy.locationPart", { location: input.location.trim() })
    : "";

  let lead = "";
  if (input.kind === "offer") {
    lead = t("feed.generatedCopy.offerBody", { category, location });
  } else {
    const lookingKey = REQUEST_LOOKING_KEYS.has(input.categoryId ?? "")
      ? `feed.generatedCopy.requestLooking.${input.categoryId}`
      : "feed.generatedCopy.requestLooking.default";
    lead = t(lookingKey, { category, when, location });
  }

  if (input.duration?.trim()) {
    lead += t("feed.generatedCopy.durationPart", { duration: input.duration.trim() });
  }
  if (input.budget?.trim()) {
    lead +=
      input.kind === "offer"
        ? t("feed.generatedCopy.ratePart", { rate: input.budget.trim() })
        : t("feed.generatedCopy.budgetPart", { budget: input.budget.trim() });
  }
  return joinListingLeadAndNotes(lead, input.notes);
}

export function joinListingLeadAndNotes(lead: string, notes?: string | null): string {
  const head = lead.trim();
  const tail = notes?.trim() ?? "";
  if (head && tail) return `${head} ${tail}`;
  return head || tail;
}
