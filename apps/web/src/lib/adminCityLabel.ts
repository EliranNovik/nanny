const HEBREW_CITY_NAMES: Record<string, string> = {
  "אשדוד": "Ashdod", "אשקלון": "Ashkelon", "באר שבע": "Beersheba",
  "בת ים": "Bat Yam", "בני ברק": "Bnei Brak", "גבעתיים": "Givatayim",
  "חדרה": "Hadera", "חולון": "Holon", "חיפה": "Haifa",
  "הרצליה": "Herzliya", "ירושלים": "Jerusalem", "כפר סבא": "Kfar Saba",
  "מודיעין": "Modiin", "נתניה": "Netanya", "פתח תקווה": "Petah Tikva",
  "ראשון לציון": "Rishon LeZion", "רחובות": "Rehovot", "רמת גן": "Ramat Gan",
  "רעננה": "Raanana", "תל אביב": "Tel Aviv",
};

export function adminCityLabel(city?: string | null): string {
  const value = city?.trim();
  if (!value) return "—";
  const cityOnly = value.split(",")[0]?.trim() || value;
  if (HEBREW_CITY_NAMES[cityOnly]) return HEBREW_CITY_NAMES[cityOnly];
  return /[\u0590-\u05ff]/.test(cityOnly) ? "—" : cityOnly;
}
