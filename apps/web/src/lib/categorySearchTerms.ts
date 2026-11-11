import { postServiceCategoryLabel } from "@/lib/serviceCategories";

/** Everyday words that should find the same category as the official name. */
const CATEGORY_ALIASES: { categoryId: string; words: string[] }[] = [
  {
    categoryId: "nanny",
    words: [
      "nanny",
      "childcare",
      "child care",
      "babysitting",
      "babysitter",
      "babysit",
      "baby sitting",
      "au pair",
      "daycare",
      "day care",
    ],
  },
  {
    categoryId: "cooking",
    words: ["cooking", "cook", "chef", "catering", "caterer", "meal", "meals", "kitchen"],
  },
  {
    categoryId: "cleaning",
    words: ["cleaning", "cleaner", "housekeeping", "house keeping", "maid", "tidy"],
  },
  {
    categoryId: "pickup_delivery",
    words: ["pickup", "pick up", "delivery", "courier", "driver", "errand", "errands"],
  },
  {
    categoryId: "home_maintenance",
    words: ["handyman", "plumber", "electrician", "repair", "repairs", "maintenance", "fix"],
  },
  {
    categoryId: "beauty_personal_care",
    words: ["beauty", "haircut", "hair", "nails", "makeup", "barber", "salon", "massage"],
  },
  {
    categoryId: "pet_help",
    words: ["pet", "dog", "cat", "dog walker", "petsitter", "pet sitter", "vet"],
  },
  {
    categoryId: "elderly_help",
    words: ["elderly", "senior", "elder care", "caregiver", "grandparent"],
  },
  {
    categoryId: "coaching_lessons",
    words: ["tutor", "tutoring", "teacher", "lesson", "lessons", "coach", "coaching", "english"],
  },
  {
    categoryId: "shopping_errands",
    words: ["shopping", "groceries", "grocery"],
  },
  {
    categoryId: "heavy_lifting_moving",
    words: ["moving", "mover", "lifting", "furniture"],
  },
  {
    categoryId: "technical_help",
    words: ["computer", "wifi", "laptop", "it support", "tech help"],
  },
  {
    categoryId: "digital_creative",
    words: ["designer", "design", "marketing", "logo", "photographer"],
  },
  {
    categoryId: "paperwork_bureaucracy",
    words: ["paperwork", "bureaucracy", "forms", "documents"],
  },
  {
    categoryId: "event_help",
    words: ["party", "wedding", "host"],
  },
];

function queryHasWord(query: string, word: string) {
  const q = query.toLowerCase();
  const needle = word.toLowerCase().trim();
  if (needle.length < 3) return false;
  if (needle.includes(" ")) return q.includes(needle);
  return new RegExp(`(?:^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z]|$)`, "i").test(q);
}

export function matchedCategoryIds(query: string): string[] {
  const ids = new Set<string>();
  for (const alias of CATEGORY_ALIASES) {
    if (alias.words.some((word) => queryHasWord(query, word))) {
      ids.add(alias.categoryId);
    }
  }
  return [...ids];
}

/** Words to look for in captions, plus the official category name. */
export function searchNeedles(query: string): string[] {
  const q = query.toLowerCase().trim();
  const needles = new Set<string>();
  if (q.length >= 2) needles.add(q);
  for (const id of matchedCategoryIds(q)) {
    needles.add(id.replace(/_/g, " "));
    const label = postServiceCategoryLabel(id)?.toLowerCase();
    if (label && label.length >= 2) needles.add(label);
  }
  return [...needles];
}

export function textHitsNeedles(hay: string, needles: string[]) {
  const value = hay.toLowerCase();
  return needles.some((needle) => needle.length >= 2 && value.includes(needle));
}
