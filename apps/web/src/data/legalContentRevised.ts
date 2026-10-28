import type { LegalContent, LegalDocument } from "@/data/legalContent";

export const LEGAL_VERSION = "2026-10-27";
export const LEGAL_EFFECTIVE_DATE = "27 October 2026";
export const LEGAL_CONTACT_EMAIL = "info@tebnu.com";

export type LegalLocale = "en" | "he" | "ru" | "fr";

function doc(
  title: string,
  effectiveDate: string,
  intro: string,
  sections: LegalDocument["sections"],
): LegalDocument {
  return { title, effectiveDate, intro, sections };
}

const dates: Record<LegalLocale, string> = {
  en: "Effective: 27 October 2026",
  he: "בתוקף מיום: 27 באוקטובר 2026",
  ru: "Дата вступления в силу: 27 октября 2026 года",
  fr: "En vigueur le 27 octobre 2026",
};

const en: LegalContent = {
  terms: doc(
    "Tebnu Terms of Service",
    dates.en,
    "These Terms govern your use of the Tebnu website and mobile applications (the “Platform”). Tebnu is currently identified for these Terms by the service name “Tebnu” and can be contacted at info@tebnu.com. By creating an account or affirmatively accepting these Terms, you agree to them and confirm that you are at least 18 years old.",
    [
      {
        title: "1. The Platform and eligibility",
        items: [
          "1.1. Tebnu is a community marketplace that helps people publish and discover requests, offers, local services, volunteering opportunities, lessons, events, community posts, profiles, messages and reviews.",
          "1.2. You must be at least 18 years old and legally able to enter agreements. You must provide accurate account information, protect your credentials and promptly update material changes.",
          "1.3. Access is currently free unless a paid feature is clearly identified with separate terms before purchase.",
        ],
      },
      {
        title: "2. Tebnu’s role",
        items: [
          "2.1. Tebnu provides discovery, communication, matching and record-keeping tools. Tebnu is not the employer, employee, agent, staffing agency, contractor, insurer or payment guarantor of users.",
          "2.2. Users decide whether to communicate, meet, volunteer, hire, work or transact. Users are responsible for checking suitability, qualifications, references, permits and any legal requirements relevant to their arrangement.",
          "2.3. Tebnu may rank, recommend, notify, label, match or display content using automated systems. These functions do not amount to an endorsement or guarantee.",
        ],
      },
      {
        title: "3. Requests, offers, matching and payment",
        items: [
          "3.1. “Accept,” “Confirm,” “Matched,” “Available,” and similar interface labels record user intentions or workflow status. They do not create a contract with Tebnu.",
          "3.2. Users must agree directly on scope, price, expenses, schedule, cancellation, payment method and payment timing. Volunteering must be clearly understood as unpaid.",
          "3.3. Unless a future feature expressly says otherwise, Tebnu does not collect, hold or transfer user payments, provide escrow, guarantee payment, resolve entitlement to payment or issue employment documentation. Payment records in the Platform are informational records between users.",
        ],
      },
      {
        title: "4. Identity verification and badges",
        items: [
          "4.1. Identity verification is optional. When shown, a Tebnu verification badge means that the user completed an identity-document and liveness process provided by Didit and Didit returned an approved result.",
          "4.2. A badge is not a criminal-record, background, qualification, licence, reference, health, CPR, employment-status or suitability check. It is not a safety guarantee. Users must make their own assessment.",
          "4.3. Phone numbers and user-provided profile statements are not verified unless the interface explicitly says otherwise.",
        ],
      },
      {
        title: "5. User content and licence",
        items: [
          "5.1. You remain responsible for profiles, posts, requests, offers, media, messages, reviews and other content you submit. Content must be lawful, accurate, non-deceptive and must not infringe another person’s rights.",
          "5.2. You grant Tebnu a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, format, translate, moderate and display your content only as needed to operate, secure, improve and promote the Platform. This licence ends when content is deleted, subject to backups, legal retention and content already shared by others.",
          "5.3. You must not harass, discriminate, threaten, impersonate, defraud, scrape, spam, upload malware, evade restrictions or publish another person’s sensitive information without authority.",
        ],
      },
      {
        title: "6. Reports, moderation and safety",
        items: [
          "6.1. Commercial disputes remain between users, and Tebnu does not adjudicate payment or contractual entitlement.",
          "6.2. Users may report suspected fraud, abuse, unsafe conduct, unlawful content or other Platform misconduct through support. Tebnu may review reports, preserve relevant information, remove content, limit features, suspend accounts, contact affected users or authorities, and take other proportionate action.",
          "6.3. Tebnu cannot guarantee that every report is accurate, that every interaction is monitored, or that every harmful act can be prevented. Nothing in these Terms removes any duty that applicable law imposes on Tebnu.",
        ],
      },
      {
        title: "7. Privacy, messages and public visibility",
        items: [
          "7.1. The Privacy Policy and Cookie & SDK Policy form part of these Terms. Public profiles, posts, reviews and listings may be visible to visitors and search engines.",
          "7.2. Messages are intended for participants. Authorized personnel may access messages where reasonably necessary for support, safety, abuse prevention, legal compliance or service security, as described in the Privacy Policy.",
        ],
      },
      {
        title: "8. Availability and intellectual property",
        items: [
          "8.1. The Platform is provided on an “as available” basis. Tebnu does not promise uninterrupted operation, perfect accuracy, a particular match or outcome, or permanent retention of content.",
          "8.2. Tebnu’s software, branding, design and non-user content are protected. No licence is granted except the limited right to use the Platform under these Terms.",
        ],
      },
      {
        title: "9. Liability",
        items: [
          "9.1. Each user is responsible for their own conduct and arrangements. To the maximum extent permitted by law, Tebnu is not responsible for losses caused solely by another user, an off-platform arrangement, or information a user supplied.",
          "9.2. To the maximum extent permitted by law, Tebnu is not liable for indirect, incidental or consequential loss that was not reasonably foreseeable.",
          "9.3. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for bodily injury, fraud, intentional wrongdoing, gross negligence, or a statutory duty where applicable law prohibits exclusion.",
        ],
      },
      {
        title: "10. Indemnity",
        items: [
          "10.1. You will reimburse Tebnu for reasonable, documented losses and third-party claims caused by your unlawful content, fraud, intentional misconduct, material breach of these Terms or infringement of another person’s rights, to the extent you are legally responsible.",
          "10.2. Tebnu will give reasonable notice and allow reasonable participation in the defence or settlement. You are not responsible for losses caused by Tebnu’s own wrongdoing.",
        ],
      },
      {
        title: "11. Suspension and termination",
        items: [
          "11.1. Tebnu may remove content or restrict, suspend or close accounts where reasonably necessary for safety, security, legal compliance, repeated complaints or material breach. Where appropriate, Tebnu may provide notice and an opportunity to respond.",
          "11.2. You may stop using Tebnu and request account deletion. Some information may be retained where required for security, disputes, legal obligations or backups.",
        ],
      },
      {
        title: "12. Changes, law and contact",
        items: [
          "12.1. Tebnu may update these Terms. Material changes will be notified in the Platform and, where appropriate, require renewed affirmative acceptance. The version and effective date appear above.",
          "12.2. These Terms are governed by the laws of Israel, without removing mandatory rights that apply to you. Before bringing a claim, contact info@tebnu.com so the parties can try to resolve it, unless urgent relief or mandatory law permits otherwise.",
          "12.3. Questions and legal notices may be sent to Tebnu at info@tebnu.com. The operator description will be updated if a formal legal entity is designated.",
        ],
      },
    ],
  ),
  disclaimer: doc(
    "Tebnu Platform Disclaimer",
    dates.en,
    "This Disclaimer explains important limits of the Platform. It does not override the Terms, Privacy Policy, mandatory consumer rights or liability that cannot legally be excluded.",
    [
      {
        title: "1. Community marketplace",
        items: [
          "Tebnu provides tools for users to find, communicate and arrange help. User profiles, posts, ratings, messages and offers are supplied by users and may be incomplete or inaccurate.",
        ],
      },
      {
        title: "2. Verification",
        items: [
          "An optional Didit badge confirms only an approved identity-document and liveness process. It is not a background, criminal-record, qualification, reference, health or suitability check and does not guarantee safety.",
        ],
      },
      {
        title: "3. User decisions",
        items: [
          "Users should independently evaluate identity, references, qualifications, legal status, price, scope, meeting arrangements and access to homes, children, older adults, property, keys, money and confidential information.",
        ],
      },
      {
        title: "4. Disputes and reports",
        items: [
          "Tebnu does not determine who is contractually entitled to payment. Reports of fraud, abuse, unsafe conduct or unlawful content may be reviewed and may lead to proportionate Platform action. A report is not a guarantee of a particular outcome.",
        ],
      },
      {
        title: "5. Liability and availability",
        items: [
          "The Platform may experience errors, outages or third-party service failures. Liability is limited only to the extent permitted by law. Nothing excludes liability that cannot lawfully be excluded, including applicable liability for bodily injury, fraud, intentional wrongdoing or gross negligence.",
        ],
      },
      {
        title: "6. Emergency and professional advice",
        items: [
          "Tebnu is not an emergency service and does not provide legal, medical, tax, immigration, employment or safety advice. Contact qualified professionals or emergency services when needed.",
        ],
      },
    ],
  ),
  privacy: doc(
    "Tebnu Privacy Policy",
    dates.en,
    "This Policy explains how Tebnu, reachable at info@tebnu.com, controls and processes personal information when you use the Platform.",
    [
      {
        title: "1. Information we collect",
        items: [
          "Account and profile data: name, email, role, photo, biography, languages, skills, contact preferences and optional phone/social details.",
          "Identity verification data: verification status, legal name and date of birth returned by Didit. Identity documents and biometric/liveness processing are handled by Didit under its own notices; Tebnu receives verification results and limited approved data.",
          "Content and communications: requests, offers, posts, media, reviews, comments, messages, support reports and attachments.",
          "Location and technical data: selected city, place identifiers, service radius, and precise coordinates when you choose location features; IP address, device/browser information, identifiers, logs and consent choices.",
        ],
      },
      {
        title: "2. Required and optional information",
        items: [
          "Email, authentication data, age confirmation and acceptance records are required to create and operate an account. Information clearly marked optional, including Didit verification and some profile/contact fields, may be refused, but related optional features may then be unavailable.",
        ],
      },
      {
        title: "3. How we use information",
        items: [
          "We use information to authenticate users; operate profiles, discovery, matching, messaging, notifications and support; maintain payment-status records; personalize and translate content; prevent fraud and abuse; investigate reports; secure and improve the Platform; comply with law; and communicate material service changes.",
          "Where applicable, processing is based on performing our agreement, your consent, compliance with legal obligations, and legitimate interests that do not override your rights. Consent may be withdrawn for future processing where consent is the basis.",
        ],
      },
      {
        title: "4. Public information and search engines",
        items: [
          "Profiles, display names, photos, cities, skills, verification status, public posts, listings, reviews and related engagement may be visible to registered users, visitors and search engines. Do not publish sensitive information you do not want made public.",
        ],
      },
      {
        title: "5. Messages, support and administrator access",
        items: [
          "Messages are generally visible to conversation participants. Authorized Tebnu personnel and service providers may access messages, reports and attachments only where reasonably necessary for support, safety, abuse prevention, security, legal compliance or technical maintenance. Access should be limited to personnel who need it.",
        ],
      },
      {
        title: "6. Recipients and service providers",
        items: [
          "We may share information with Supabase (database/auth/storage), hosting and infrastructure providers, Didit (optional identity verification), Google services including Maps and consented Tag Manager/analytics, Firebase and Apple push services, Resend (contact email), and professional advisers or authorities where legally required.",
          "We do not sell personal information. We do not permit service providers to use it for unrelated purposes.",
        ],
      },
      {
        title: "7. International transfers",
        items: [
          "Providers may process information outside Israel. We use contractual, organizational or other lawful safeguards appropriate to the destination and service.",
        ],
      },
      {
        title: "8. Retention and deletion",
        items: [
          "We retain account information while the account is active and thereafter only as reasonably needed for deletion processing, security, fraud prevention, disputes, accounting, legal obligations and backups. Retention depends on the data type and purpose.",
          "Account deletion removes or de-identifies information where reasonably possible. Some transaction, moderation, consent, security and legal records may be retained when required or justified. Content copied or shared by others may remain.",
        ],
      },
      {
        title: "9. Security",
        items: [
          "We use access controls, authentication, database policies, encryption in transit, logging and service-provider safeguards. No system is completely secure; notify info@tebnu.com if you suspect unauthorized access.",
        ],
      },
      {
        title: "10. Your rights",
        items: [
          "Subject to applicable law, you may request access, correction, deletion, restriction or a copy of information and may object to or withdraw consent for certain processing. Send requests to info@tebnu.com. We may need to verify identity before acting.",
        ],
      },
      {
        title: "11. Age eligibility",
        items: [
          "Tebnu accounts are for people aged 18 or older. If we learn that a minor created an account, we may restrict it and delete associated information, subject to legal retention.",
        ],
      },
      {
        title: "12. Changes and contact",
        items: [
          "Material changes will be notified in the Platform and, where appropriate, require renewed acceptance or consent. Privacy questions and rights requests may be sent to Tebnu at info@tebnu.com.",
        ],
      },
    ],
  ),
  cookies: doc(
    "Tebnu Cookie & SDK Policy",
    dates.en,
    "This Policy describes browser cookies, local storage, pixels and mobile SDKs. Non-essential web analytics are loaded only after consent.",
    [
      {
        title: "1. Essential technologies",
        items: [
          "Supabase authentication storage, security controls, language/theme settings and core preferences are necessary to sign in, secure sessions and provide requested functionality. Disabling them may prevent the Platform from working.",
        ],
      },
      {
        title: "2. Analytics and measurement",
        items: [
          "With consent, Tebnu may load Google Tag Manager and configured analytics tags to understand visits and feature use. Tebnu also uses first-party event and session storage for product performance. We do not currently describe advertising cookies as active.",
        ],
      },
      {
        title: "3. Mobile SDKs and third-party resources",
        items: [
          "Mobile apps may use Firebase Analytics and Firebase/Apple push SDKs. Maps, fonts and mapping resources may receive technical request data when loaded. Mobile SDK controls differ from browser cookie settings.",
        ],
      },
      {
        title: "4. Your choices",
        items: [
          "You can accept or reject non-essential analytics and later change your choice through Cookie settings. Rejecting analytics does not disable essential account features. Browser or device settings may offer additional controls.",
        ],
      },
      {
        title: "5. Contact",
        items: ["Questions may be sent to info@tebnu.com."],
      },
    ],
  ),
};

// The translated documents intentionally mirror the English structure and legal meaning.
const he: LegalContent = {
  terms: doc("תנאי השימוש של Tebnu", dates.he, "תנאים אלה מסדירים את השימוש באתר וביישומוני Tebnu. המפעיל מזוהה בשלב זה בשם השירות “Tebnu” וניתן ליצור עמו קשר בכתובת info@tebnu.com. ביצירת חשבון או באישור מפורש של התנאים אתם מסכימים להם ומאשרים שגילכם 18 לפחות.", [
    { title: "1. הפלטפורמה והזכאות", items: ["Tebnu היא זירת קהילה לבקשות והצעות עזרה, שירותים מקומיים, התנדבות, שיעורים, אירועים, פוסטים, הודעות וביקורות.", "השימוש בחשבון מותר מגיל 18 בלבד. יש למסור מידע נכון, לשמור על פרטי ההתחברות ולעדכן שינויים מהותיים.", "הגישה חינמית כעת, אלא אם תכונה בתשלום תוצג במפורש עם תנאים נפרדים."] },
    { title: "2. תפקידה של Tebnu", items: ["Tebnu מספקת כלי גילוי, תקשורת, התאמה ורישום. היא אינה מעסיק, עובד, קבלן, סוכנות כוח אדם, מבטח או ערב לתשלום.", "המשתמשים מחליטים אם לתקשר, להיפגש, להתנדב, לשכור, לעבוד או להתקשר בעסקה ואחראים לבדיקות התאמה, כישורים, המלצות והיתרים.", "דירוגים, המלצות והתאמות אוטומטיות אינם אישור או התחייבות."] },
    { title: "3. בקשות, הצעות, התאמה ותשלום", items: ["המונחים „קבלה”, „אישור”, „התאמה” ו„זמין” מתעדים כוונה או מצב בתהליך ואינם יוצרים חוזה עם Tebnu.", "המשתמשים מסכימים ישירות על היקף, מחיר, הוצאות, לוח זמנים, ביטול ואופן ומועד תשלום. התנדבות תובן כפעילות ללא תשלום.", "אלא אם נאמר אחרת במפורש, Tebnu אינה גובה או מחזיקה כספים, אינה מספקת נאמנות ואינה מבטיחה תשלום. רשומות תשלום הן מידע בין משתמשים."] },
    { title: "4. אימות זהות ותגים", items: ["אימות הזהות אופציונלי. תג אימות מציין שהמשתמש השלים בדיקת מסמך זהות וחיות באמצעות Didit ושהתקבלה תוצאה מאושרת.", "התג אינו בדיקת רקע, רישום פלילי, כישורים, רישיון, המלצות, בריאות, החייאה או התאמה ואינו ערובה לבטיחות.", "מספרי טלפון והצהרות בפרופיל אינם מאומתים אלא אם הממשק אומר זאת במפורש."] },
    { title: "5. תוכן משתמשים ורישיון", items: ["המשתמש אחראי לפרופילים, פוסטים, בקשות, הצעות, מדיה, הודעות וביקורות שפרסם. התוכן חייב להיות חוקי, מדויק ולא מטעה.", "אתם מעניקים ל-Tebnu רישיון לא בלעדי וללא תמלוגים לאחסן, לעצב, לתרגם, למתן ולהציג תוכן לצורך הפעלת הפלטפורמה, אבטחתה, שיפורה וקידומה.", "אסור להטריד, להפלות, לאיים, להתחזות, להונות, לגרד מידע, לשלוח ספאם, להעלות נוזקה או לפרסם מידע רגיש ללא סמכות."] },
    { title: "6. דיווחים, מיתון ובטיחות", items: ["מחלוקות מסחריות נשארות בין המשתמשים ו-Tebnu אינה מכריעה בזכאות חוזית לתשלום.", "ניתן לדווח על הונאה, התעללות, התנהגות מסוכנת או תוכן בלתי חוקי. Tebnu רשאית לבדוק, לשמור מידע, להסיר תוכן, להגביל חשבונות ולפנות לרשויות באופן מידתי.", "אין אפשרות להבטיח שכל דיווח נכון או שכל נזק יימנע. אין בתנאים כדי לבטל חובה שהדין מטיל על Tebnu."] },
    { title: "7. פרטיות ונראות", items: ["מדיניות הפרטיות ומדיניות העוגיות וה-SDK הן חלק מהתנאים. פרופילים, פוסטים וביקורות ציבוריים עשויים להיות גלויים למבקרים ולמנועי חיפוש.", "אנשי צוות מורשים רשאים לגשת להודעות רק לצורך תמיכה, בטיחות, מניעת שימוש לרעה, ציות לדין או אבטחה, כמפורט במדיניות הפרטיות."] },
    { title: "8. זמינות וקניין רוחני", items: ["הפלטפורמה ניתנת כפי שהיא זמינה, ללא הבטחה לפעולה רציפה, דיוק מושלם, התאמה או תוצאה מסוימת.", "התוכנה, המותג והעיצוב של Tebnu מוגנים. ניתן רק רישיון מוגבל לשימוש לפי תנאים אלה."] },
    { title: "9. אחריות", items: ["כל משתמש אחראי להתנהגותו ולהסדריו. ככל שהדין מתיר, Tebnu אינה אחראית לנזק שנגרם רק בידי משתמש אחר או בהסדר מחוץ לפלטפורמה.", "ככל שהדין מתיר, Tebnu אינה אחראית לנזק עקיף או תוצאתי שלא היה צפוי באופן סביר.", "אין בתנאים כדי לשלול אחריות שלא ניתן לשלול כדין, לרבות אחריות רלוונטית לנזק גוף, הונאה, מעשה מכוון או רשלנות רבתי."] },
    { title: "10. שיפוי", items: ["המשתמש ישפה את Tebnu על הפסדים סבירים ומתועדים ותביעות צד שלישי שנגרמו מתוכן בלתי חוקי, הונאה, מעשה מכוון, הפרה מהותית או פגיעה בזכויות, במידה שהוא אחראי לפי דין.", "Tebnu תמסור הודעה סבירה ותאפשר השתתפות סבירה בהגנה. המשתמש אינו אחראי לנזק שנגרם ממעשה פסול של Tebnu."] },
    { title: "11. הגבלה וסיום", items: ["Tebnu רשאית להסיר תוכן או להגביל חשבון מטעמי בטיחות, אבטחה, דין, תלונות חוזרות או הפרה מהותית, ותמסור הודעה כאשר הדבר מתאים.", "ניתן להפסיק להשתמש ולבקש מחיקת חשבון. מידע מסוים עשוי להישמר לצורכי אבטחה, מחלוקות, דין וגיבויים."] },
    { title: "12. שינויים, דין ויצירת קשר", items: ["שינוי מהותי יימסר בפלטפורמה ובמידת הצורך ידרוש אישור מפורש מחדש.", "על התנאים חל דין מדינת ישראל, בלי לגרוע מזכויות קוגנטיות. ניתן לפנות תחילה אל info@tebnu.com.", "שאלות והודעות משפטיות ניתן לשלוח ל-Tebnu בכתובת info@tebnu.com. פרטי המפעיל יעודכנו אם ייקבע תאגיד רשמי."] },
  ]),
  disclaimer: doc("כתב ויתור והבהרות של Tebnu", dates.he, "מסמך זה מסביר מגבלות חשובות ואינו גובר על התנאים, מדיניות הפרטיות או אחריות שלא ניתן לשלול בדין.", [
    { title: "1. זירת קהילה", items: ["Tebnu מספקת כלים לאיתור, תקשורת ותיאום. מידע משתמשים עלול להיות חלקי או שגוי."] },
    { title: "2. אימות", items: ["תג Didit אופציונלי מאשר רק תהליך מסמך זהות וחיות שאושר; הוא אינו בדיקת רקע, כישורים או ערובה לבטיחות."] },
    { title: "3. החלטות משתמשים", items: ["יש לבדוק עצמאית זהות, המלצות, כישורים, מחיר, היקף וסידורי גישה לבית, ילדים, מבוגרים, רכוש וכסף."] },
    { title: "4. מחלוקות ודיווחים", items: ["Tebnu אינה מכריעה בזכאות לתשלום. דיווחי הונאה, התעללות או סכנה עשויים להיבדק ולהוביל לפעולה מידתית, ללא הבטחה לתוצאה מסוימת."] },
    { title: "5. אחריות וזמינות", items: ["ייתכנו תקלות ושיבושי צד שלישי. האחריות מוגבלת רק ככל שהדין מתיר ואין שלילה של אחריות שאסור לשלול."] },
    { title: "6. חירום וייעוץ", items: ["Tebnu אינה שירות חירום ואינה נותנת ייעוץ משפטי, רפואי, מס, הגירה, עבודה או בטיחות."] },
  ]),
  privacy: doc("מדיניות הפרטיות של Tebnu", dates.he, "מדיניות זו מסבירה כיצד Tebnu, בכתובת info@tebnu.com, שולטת ומעבדת מידע אישי.", [
    { title: "1. מידע שנאסף", items: ["פרטי חשבון ופרופיל; תוצאות מוגבלות של אימות Didit; פוסטים, בקשות, הצעות, הודעות ותמיכה; עיר, קואורדינטות שנבחרו, IP, מכשיר, יומנים והעדפות הסכמה."] },
    { title: "2. מידע חובה ואופציונלי", items: ["אימייל, אימות, אישור גיל וקבלת מסמכים נדרשים לחשבון. Didit ושדות מסוימים הם אופציונליים, אך תכונות קשורות עלולות לא להיות זמינות."] },
    { title: "3. מטרות ובסיסי עיבוד", items: ["המידע משמש להפעלת חשבונות, גילוי, התאמה, הודעות, תמיכה, תרגום, אבטחה, מניעת הונאה, ציות ושיפור. הבסיסים עשויים להיות חוזה, הסכמה, חובה חוקית ואינטרסים לגיטימיים מאוזנים."] },
    { title: "4. מידע ציבורי", items: ["פרופילים, שמות תצוגה, תמונות, ערים, כישורים, תגים, פוסטים, רשימות וביקורות עשויים להיות גלויים למשתמשים, מבקרים ומנועי חיפוש."] },
    { title: "5. הודעות וגישה מנהלית", items: ["הודעות מיועדות למשתתפים. אנשי צוות וספקים מורשים רשאים לגשת אליהן רק לצורך תמיכה, בטיחות, מניעת שימוש לרעה, אבטחה, דין או תחזוקה."] },
    { title: "6. מקבלים וספקים", items: ["המידע עשוי להימסר ל-Supabase, אירוח, Didit, Google Maps ו-GTM/Analytics בהסכמה, Firebase, Apple push, Resend, יועצים ורשויות. איננו מוכרים מידע אישי."] },
    { title: "7. העברות בינלאומיות", items: ["ספקים עשויים לעבד מידע מחוץ לישראל בכפוף להגנות חוזיות, ארגוניות או חוקיות מתאימות."] },
    { title: "8. שמירה ומחיקה", items: ["מידע נשמר כל עוד החשבון פעיל ולאחר מכן לפי צורך באבטחה, הונאה, מחלוקות, דין וגיבויים. מחיקה מסירה או מזהה מחדש מידע ככל שניתן; רשומות מסוימות עשויות להישמר כדין."] },
    { title: "9. אבטחה", items: ["אנו משתמשים בבקרות גישה, אימות, מדיניות מסד נתונים, הצפנה בתעבורה ויומנים. אין מערכת בטוחה לחלוטין."] },
    { title: "10. זכויות", items: ["בכפוף לדין ניתן לבקש עיון, תיקון, מחיקה, הגבלה או עותק ולהתנגד או למשוך הסכמה. פנו אל info@tebnu.com."] },
    { title: "11. גיל", items: ["חשבונות Tebnu מיועדים לבני 18 ומעלה בלבד. חשבון קטין עשוי להיות מוגבל ולהימחק."] },
    { title: "12. שינויים ויצירת קשר", items: ["שינויים מהותיים יימסרו ובמידת הצורך ידרשו אישור מחדש. שאלות ובקשות: info@tebnu.com."] },
  ]),
  cookies: doc("מדיניות עוגיות ו-SDK של Tebnu", dates.he, "מדיניות זו מתארת עוגיות, אחסון מקומי, פיקסלים ו-SDK. ניתוח אינטרנט לא חיוני נטען רק לאחר הסכמה.", [
    { title: "1. טכנולוגיות חיוניות", items: ["אחסון אימות Supabase, אבטחה, שפה, ערכת נושא והעדפות ליבה נדרשים להפעלת החשבון."] },
    { title: "2. ניתוח", items: ["בהסכמה ניתן לטעון Google Tag Manager ותגי ניתוח. איננו מציגים עוגיות פרסום כפעילות כיום."] },
    { title: "3. SDK ומשאבי צד שלישי", items: ["יישומונים עשויים להשתמש ב-Firebase Analytics ובהודעות Firebase/Apple. מפות וגופנים עשויים לקבל נתוני בקשה טכניים."] },
    { title: "4. בחירות", items: ["ניתן לאשר או לדחות ניתוח לא חיוני ולשנות את הבחירה בהגדרות העוגיות. דחייה אינה משביתה תכונות חשבון חיוניות."] },
    { title: "5. קשר", items: ["שאלות: info@tebnu.com."] },
  ]),
};

const ru: LegalContent = {
  terms: doc("Условия использования Tebnu", dates.ru, "Настоящие Условия регулируют использование сайта и приложений Tebnu. Оператор пока обозначен названием сервиса «Tebnu»; контакт: info@tebnu.com. Создавая аккаунт или явно принимая Условия, вы соглашаетесь с ними и подтверждаете, что вам исполнилось 18 лет.", [
    { title: "1. Платформа и возраст", items: ["Tebnu — общественная онлайн-площадка для запросов и предложений помощи, местных услуг, волонтёрства, занятий, событий, публикаций, сообщений и отзывов.", "Аккаунты доступны только с 18 лет. Указывайте достоверные данные, защищайте доступ и обновляйте существенные сведения.", "Доступ сейчас бесплатный, если платная функция не обозначена отдельно с особыми условиями."] },
    { title: "2. Роль Tebnu", items: ["Tebnu предоставляет поиск, общение, сопоставление и учёт. Tebnu не является работодателем, работником, подрядчиком, агентством, страховщиком или гарантом оплаты.", "Пользователи сами решают, общаться ли, встречаться, нанимать, работать, помогать бесплатно или заключать сделку, и сами проверяют пригодность, навыки, рекомендации и разрешения.", "Автоматические рейтинги, рекомендации и совпадения не являются одобрением или гарантией."] },
    { title: "3. Запросы, предложения и оплата", items: ["«Принять», «Подтвердить», «Совпадение» и «Доступен» отражают намерение или этап процесса и не создают договор с Tebnu.", "Пользователи напрямую согласуют объём, цену, расходы, график, отмену, способ и срок оплаты. Волонтёрство понимается как неоплачиваемое.", "Если явно не указано иное, Tebnu не принимает и не хранит деньги, не предоставляет эскроу и не гарантирует оплату. Платёжные записи носят информационный характер."] },
    { title: "4. Проверка личности", items: ["Проверка добровольна. Значок означает, что пользователь прошёл проверку документа и «живости» у Didit и получил одобрение.", "Значок не подтверждает судимость, биографию, квалификацию, лицензию, рекомендации, здоровье, CPR или пригодность и не гарантирует безопасность.", "Телефон и заявления профиля не проверены, если интерфейс прямо не говорит обратное."] },
    { title: "5. Контент и лицензия", items: ["Пользователь отвечает за профили, публикации, запросы, предложения, медиа, сообщения и отзывы. Контент должен быть законным, точным и не нарушать чужих прав.", "Вы даёте Tebnu неисключительную безвозмездную лицензию хранить, форматировать, переводить, модерировать и показывать контент для работы, защиты, улучшения и продвижения Платформы.", "Запрещены угрозы, дискриминация, обман, выдача себя за другого, скрейпинг, спам, вредоносный код и публикация чужих чувствительных данных без права."] },
    { title: "6. Жалобы и безопасность", items: ["Коммерческие споры остаются между пользователями; Tebnu не решает, кто имеет договорное право на оплату.", "О мошенничестве, насилии, опасном поведении и незаконном контенте можно сообщить поддержке. Tebnu вправе проверить, сохранить сведения, удалить контент, ограничить аккаунт и обратиться к властям.", "Tebnu не гарантирует точность каждой жалобы или предотвращение любого вреда. Условия не отменяют обязанностей Tebnu по закону."] },
    { title: "7. Конфиденциальность", items: ["Политика конфиденциальности и Политика cookies/SDK являются частью Условий. Публичные профили и публикации могут быть видны посетителям и поисковым системам.", "Уполномоченные сотрудники могут получить доступ к сообщениям только для поддержки, безопасности, предотвращения злоупотреблений, соблюдения закона или защиты сервиса."] },
    { title: "8. Доступность и права", items: ["Платформа предоставляется по мере доступности без гарантии непрерывности, абсолютной точности или результата.", "ПО, бренд и дизайн Tebnu защищены; предоставляется лишь ограниченное право использования по этим Условиям."] },
    { title: "9. Ответственность", items: ["Каждый пользователь отвечает за своё поведение и договорённости. В допустимой законом мере Tebnu не отвечает за ущерб, причинённый исключительно другим пользователем или внешней договорённостью.", "В допустимой законом мере исключаются непредвидимые косвенные и последующие убытки.", "Не исключается ответственность, которую нельзя исключить законом, включая применимую ответственность за телесный вред, мошенничество, умышленное нарушение или грубую неосторожность."] },
    { title: "10. Возмещение", items: ["Пользователь возмещает разумные документированные потери и требования третьих лиц, вызванные его незаконным контентом, мошенничеством, умышленным нарушением, существенным нарушением Условий или чужих прав, в пределах его ответственности.", "Tebnu уведомит о требовании и позволит разумно участвовать в защите. Пользователь не отвечает за нарушения самой Tebnu."] },
    { title: "11. Ограничение и закрытие", items: ["Tebnu может удалить контент или ограничить аккаунт ради безопасности, закона, повторных жалоб или существенного нарушения, по возможности уведомив пользователя.", "Можно прекратить использование и запросить удаление. Часть данных может храниться для безопасности, споров, закона и резервных копий."] },
    { title: "12. Изменения, право и контакты", items: ["О существенных изменениях сообщается в Платформе; при необходимости потребуется новое явное согласие.", "Применяется право Израиля без ограничения обязательных прав. Для урегулирования можно сначала написать на info@tebnu.com.", "Юридические уведомления: Tebnu, info@tebnu.com. Данные будут обновлены при назначении формального юридического лица."] },
  ]),
  disclaimer: doc("Отказ от ответственности Tebnu", dates.ru, "Документ разъясняет ограничения Платформы и не отменяет Условия, Политику конфиденциальности и ответственность, которую нельзя исключить законом.", [
    { title: "1. Общественная площадка", items: ["Tebnu даёт инструменты поиска и общения. Пользовательские сведения могут быть неполными или ошибочными."] },
    { title: "2. Проверка", items: ["Добровольный значок Didit подтверждает лишь одобренную проверку документа и «живости», а не биографию, судимость, квалификацию или безопасность."] },
    { title: "3. Решения пользователей", items: ["Самостоятельно проверяйте личность, рекомендации, навыки, цену, объём и доступ к дому, детям, пожилым, имуществу, ключам и деньгам."] },
    { title: "4. Споры и жалобы", items: ["Tebnu не решает вопрос права на оплату. Жалобы на мошенничество, насилие и опасность могут быть проверены и повлечь соразмерные меры без гарантии результата."] },
    { title: "5. Ответственность и доступность", items: ["Возможны ошибки и сбои поставщиков. Ответственность ограничена лишь в разрешённой законом мере; обязательная ответственность не исключается."] },
    { title: "6. Экстренная помощь", items: ["Tebnu не является экстренной службой и не даёт юридических, медицинских, налоговых, миграционных, трудовых или профессиональных советов."] },
  ]),
  privacy: doc("Политика конфиденциальности Tebnu", dates.ru, "Политика объясняет, как Tebnu (info@tebnu.com) контролирует и обрабатывает персональные данные.", [
    { title: "1. Данные", items: ["Данные аккаунта и профиля; ограниченные результаты Didit; публикации, запросы, предложения, сообщения и обращения; город, выбранные координаты, IP, устройство, журналы и выбор согласия."] },
    { title: "2. Обязательные и добровольные данные", items: ["Email, аутентификация, подтверждение возраста и принятие документов нужны для аккаунта. Didit и часть полей добровольны, но связанные функции могут быть недоступны."] },
    { title: "3. Цели и основания", items: ["Данные используются для аккаунтов, поиска, совпадений, сообщений, поддержки, перевода, безопасности, предотвращения мошенничества, соблюдения закона и улучшения. Основания: договор, согласие, закон и сбалансированный законный интерес."] },
    { title: "4. Публичность", items: ["Профили, имена, фото, города, навыки, значки, публикации, объявления и отзывы могут быть видны пользователям, посетителям и поисковикам."] },
    { title: "5. Сообщения и администраторы", items: ["Сообщения предназначены участникам. Уполномоченный персонал и поставщики получают доступ только для поддержки, безопасности, борьбы со злоупотреблениями, закона или техобслуживания."] },
    { title: "6. Получатели", items: ["Данные могут передаваться Supabase, хостингу, Didit, Google Maps и согласованным GTM/Analytics, Firebase, Apple push, Resend, консультантам и властям. Мы не продаём данные."] },
    { title: "7. Международные передачи", items: ["Поставщики могут обрабатывать данные вне Израиля с договорными, организационными или иными законными гарантиями."] },
    { title: "8. Хранение и удаление", items: ["Данные хранятся при активном аккаунте и затем для безопасности, споров, закона и резервных копий. Удаление устраняет или обезличивает данные по возможности; некоторые записи сохраняются законно."] },
    { title: "9. Безопасность", items: ["Используются контроль доступа, аутентификация, политики БД, шифрование при передаче и журналы. Полной безопасности не существует."] },
    { title: "10. Права", items: ["По закону можно запросить доступ, исправление, удаление, ограничение или копию, возразить или отозвать согласие: info@tebnu.com."] },
    { title: "11. Возраст", items: ["Аккаунты Tebnu предназначены только для лиц 18 лет и старше. Аккаунт несовершеннолетнего может быть ограничен и удалён."] },
    { title: "12. Изменения и контакт", items: ["О существенных изменениях сообщается; при необходимости запрашивается новое согласие. Контакт: info@tebnu.com."] },
  ]),
  cookies: doc("Политика cookies и SDK Tebnu", dates.ru, "Политика описывает cookies, локальное хранилище, пиксели и мобильные SDK. Необязательная веб-аналитика загружается только после согласия.", [
    { title: "1. Необходимые технологии", items: ["Хранилище аутентификации Supabase, безопасность, язык, тема и основные настройки нужны для работы аккаунта."] },
    { title: "2. Аналитика", items: ["С согласия могут загружаться Google Tag Manager и аналитические теги. Мы не заявляем, что рекламные cookies сейчас активны."] },
    { title: "3. SDK и внешние ресурсы", items: ["Приложения могут использовать Firebase Analytics и Firebase/Apple push. Карты и шрифты получают технические данные запросов."] },
    { title: "4. Выбор", items: ["Можно принять или отклонить необязательную аналитику и изменить выбор в настройках cookies. Отказ не отключает основные функции аккаунта."] },
    { title: "5. Контакт", items: ["Вопросы: info@tebnu.com."] },
  ]),
};

const fr: LegalContent = {
  terms: doc("Conditions d’utilisation de Tebnu", dates.fr, "Les présentes Conditions régissent le site et les applications Tebnu. L’opérateur est provisoirement identifié sous le nom de service « Tebnu » et joignable à info@tebnu.com. En créant un compte ou en acceptant expressément, vous confirmez avoir au moins 18 ans.", [
    { title: "1. Plateforme et admissibilité", items: ["Tebnu est une place de marché communautaire pour demandes et offres d’aide, services locaux, bénévolat, cours, événements, publications, messages et avis.", "Les comptes sont réservés aux personnes de 18 ans ou plus. Fournissez des informations exactes et protégez vos identifiants.", "L’accès est actuellement gratuit sauf fonction payante clairement présentée avec des conditions distinctes."] },
    { title: "2. Rôle de Tebnu", items: ["Tebnu fournit des outils de découverte, communication, mise en relation et suivi. Tebnu n’est ni employeur, employé, entrepreneur, agence, assureur ni garant de paiement.", "Les utilisateurs décident de communiquer, se rencontrer, faire du bénévolat, embaucher, travailler ou conclure une transaction et vérifient eux-mêmes aptitude, qualifications, références et autorisations.", "Classements, recommandations et mises en relation automatisés ne sont ni une approbation ni une garantie."] },
    { title: "3. Demandes, offres et paiement", items: ["« Accepter », « Confirmer », « Mise en relation » et « Disponible » indiquent une intention ou une étape et ne créent pas de contrat avec Tebnu.", "Les utilisateurs conviennent directement de la mission, du prix, des frais, du calendrier, de l’annulation et du paiement. Le bénévolat est compris comme non rémunéré.", "Sauf indication expresse, Tebnu n’encaisse ni ne détient les paiements, ne fournit pas de séquestre et ne garantit pas le paiement. Les écritures de paiement sont informatives."] },
    { title: "4. Vérification", items: ["La vérification est facultative. Le badge indique une vérification de document d’identité et de présence par Didit ayant reçu un résultat approuvé.", "Ce badge n’est pas une vérification d’antécédents, casier, diplôme, licence, référence, santé, secourisme ou aptitude et ne garantit pas la sécurité.", "Les numéros et déclarations de profil ne sont pas vérifiés sauf mention expresse."] },
    { title: "5. Contenu et licence", items: ["Vous êtes responsable des profils, publications, demandes, offres, médias, messages et avis. Le contenu doit être licite, exact et respectueux des droits d’autrui.", "Vous accordez à Tebnu une licence non exclusive et gratuite pour héberger, formater, traduire, modérer et afficher le contenu afin d’exploiter, sécuriser, améliorer et promouvoir la Plateforme.", "Sont interdits harcèlement, discrimination, menaces, usurpation, fraude, scraping, spam, logiciels malveillants et publication non autorisée de données sensibles."] },
    { title: "6. Signalements et sécurité", items: ["Les litiges commerciaux restent entre utilisateurs; Tebnu ne tranche pas le droit contractuel au paiement.", "Fraude, abus, danger et contenu illicite peuvent être signalés. Tebnu peut examiner, conserver des preuves, retirer du contenu, limiter un compte ou contacter les autorités de façon proportionnée.", "Tebnu ne garantit ni l’exactitude de chaque signalement ni la prévention de tout dommage. Aucune obligation légale de Tebnu n’est supprimée."] },
    { title: "7. Vie privée et visibilité", items: ["La Politique de confidentialité et la Politique cookies/SDK font partie des Conditions. Profils et contenus publics peuvent être visibles aux visiteurs et moteurs de recherche.", "Le personnel autorisé peut accéder aux messages uniquement pour assistance, sécurité, abus, conformité ou maintenance, selon la Politique de confidentialité."] },
    { title: "8. Disponibilité et propriété", items: ["La Plateforme est fournie selon disponibilité, sans garantie d’interruption nulle, d’exactitude parfaite ou de résultat.", "Le logiciel, la marque et le design Tebnu sont protégés; seul un droit limité d’utilisation est accordé."] },
    { title: "9. Responsabilité", items: ["Chaque utilisateur répond de sa conduite et de ses accords. Dans la mesure permise, Tebnu ne répond pas d’un dommage causé uniquement par un autre utilisateur ou un accord externe.", "Dans la mesure permise, les pertes indirectes ou consécutives imprévisibles sont exclues.", "Rien n’exclut une responsabilité que la loi interdit d’exclure, notamment pour dommage corporel, fraude, faute intentionnelle ou faute lourde selon le droit applicable."] },
    { title: "10. Indemnisation", items: ["Vous remboursez les pertes raisonnables et documentées et réclamations de tiers causées par votre contenu illicite, fraude, faute intentionnelle, violation substantielle ou atteinte aux droits, dans la mesure de votre responsabilité.", "Tebnu vous informera raisonnablement et permettra une participation à la défense. Vous ne répondez pas des fautes propres de Tebnu."] },
    { title: "11. Suspension et fin", items: ["Tebnu peut retirer du contenu ou limiter un compte pour sécurité, conformité, plaintes répétées ou violation substantielle, avec avis lorsque cela convient.", "Vous pouvez cesser d’utiliser Tebnu et demander la suppression; certaines données peuvent être conservées pour sécurité, litiges, loi et sauvegardes."] },
    { title: "12. Modifications, droit et contact", items: ["Les changements importants seront notifiés et, si nécessaire, soumis à une nouvelle acceptation expresse.", "Le droit israélien s’applique sans supprimer les droits impératifs. Contact préalable possible à info@tebnu.com.", "Notifications juridiques: Tebnu, info@tebnu.com. Les coordonnées seront mises à jour si une entité juridique formelle est désignée."] },
  ]),
  disclaimer: doc("Avertissement Tebnu", dates.fr, "Ce document précise les limites de la Plateforme sans remplacer les Conditions, la Politique de confidentialité ou les responsabilités légalement impératives.", [
    { title: "1. Place de marché", items: ["Tebnu fournit des outils de recherche et communication. Les informations des utilisateurs peuvent être incomplètes ou inexactes."] },
    { title: "2. Vérification", items: ["Le badge Didit facultatif confirme seulement une vérification approuvée de document et de présence, pas les antécédents, qualifications ni la sécurité."] },
    { title: "3. Décisions des utilisateurs", items: ["Vérifiez vous-même identité, références, compétences, prix, mission et accès au domicile, enfants, personnes âgées, biens, clés et argent."] },
    { title: "4. Litiges et signalements", items: ["Tebnu ne tranche pas le droit au paiement. Les signalements de fraude, abus ou danger peuvent être examinés et entraîner des mesures proportionnées sans résultat garanti."] },
    { title: "5. Responsabilité et disponibilité", items: ["Erreurs et pannes de tiers sont possibles. La responsabilité n’est limitée que dans la mesure permise; aucune responsabilité impérative n’est exclue."] },
    { title: "6. Urgences et conseils", items: ["Tebnu n’est pas un service d’urgence et ne donne pas de conseils juridiques, médicaux, fiscaux, migratoires, professionnels ou de sécurité."] },
  ]),
  privacy: doc("Politique de confidentialité Tebnu", dates.fr, "Cette Politique explique comment Tebnu (info@tebnu.com) contrôle et traite les données personnelles.", [
    { title: "1. Données collectées", items: ["Compte et profil; résultats limités Didit; publications, demandes, offres, messages et assistance; ville, coordonnées choisies, IP, appareil, journaux et choix de consentement."] },
    { title: "2. Données obligatoires et facultatives", items: ["Email, authentification, confirmation d’âge et acceptations sont nécessaires au compte. Didit et certains champs sont facultatifs, mais les fonctions liées peuvent être indisponibles."] },
    { title: "3. Finalités et bases", items: ["Données utilisées pour comptes, découverte, mise en relation, messages, assistance, traduction, sécurité, fraude, conformité et amélioration. Bases possibles: contrat, consentement, obligation légale et intérêt légitime équilibré."] },
    { title: "4. Données publiques", items: ["Profils, noms, photos, villes, compétences, badges, publications, annonces et avis peuvent être visibles aux utilisateurs, visiteurs et moteurs de recherche."] },
    { title: "5. Messages et accès administratif", items: ["Messages destinés aux participants. Personnel et prestataires autorisés y accèdent seulement pour assistance, sécurité, abus, conformité ou maintenance."] },
    { title: "6. Destinataires", items: ["Données pouvant être confiées à Supabase, hébergement, Didit, Google Maps et GTM/Analytics consentis, Firebase, Apple push, Resend, conseillers et autorités. Nous ne vendons pas les données."] },
    { title: "7. Transferts internationaux", items: ["Des prestataires peuvent traiter hors d’Israël avec des garanties contractuelles, organisationnelles ou légales appropriées."] },
    { title: "8. Conservation et suppression", items: ["Conservation pendant le compte puis selon les besoins de sécurité, fraude, litiges, loi et sauvegardes. Suppression ou anonymisation lorsque possible; certains dossiers restent conservés légalement."] },
    { title: "9. Sécurité", items: ["Contrôles d’accès, authentification, politiques de base, chiffrement en transit et journaux sont utilisés. Aucun système n’est totalement sûr."] },
    { title: "10. Vos droits", items: ["Selon la loi, demandez accès, correction, suppression, limitation ou copie, opposez-vous ou retirez votre consentement à info@tebnu.com."] },
    { title: "11. Âge", items: ["Les comptes Tebnu sont réservés aux personnes de 18 ans ou plus. Le compte d’un mineur peut être limité et supprimé."] },
    { title: "12. Changements et contact", items: ["Les changements importants seront notifiés et, si nécessaire, soumis à une nouvelle acceptation. Contact: info@tebnu.com."] },
  ]),
  cookies: doc("Politique cookies et SDK Tebnu", dates.fr, "Cette Politique décrit cookies, stockage local, pixels et SDK mobiles. L’analytique web non essentielle ne se charge qu’après consentement.", [
    { title: "1. Technologies essentielles", items: ["Stockage d’authentification Supabase, sécurité, langue, thème et préférences de base sont nécessaires au compte."] },
    { title: "2. Analytique", items: ["Avec consentement, Google Tag Manager et des balises analytiques peuvent être chargés. Nous ne présentons pas de cookies publicitaires comme actifs actuellement."] },
    { title: "3. SDK et ressources tierces", items: ["Les apps peuvent utiliser Firebase Analytics et les notifications Firebase/Apple. Cartes et polices reçoivent des données techniques de requête."] },
    { title: "4. Choix", items: ["Acceptez ou refusez l’analytique non essentielle et modifiez votre choix dans les réglages cookies. Le refus ne désactive pas les fonctions essentielles."] },
    { title: "5. Contact", items: ["Questions: info@tebnu.com."] },
  ]),
};

export const revisedLegalContent: Record<LegalLocale, LegalContent> = { en, he, ru, fr };
