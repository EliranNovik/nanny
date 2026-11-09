import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
import { ContactUsContent } from "@/components/ContactUsContent";
import { Footer } from "@/components/Footer";
import { usePageSeo } from "@/lib/seo";
import { useTranslation } from "react-i18next";

export default function ContactPage() {
  const { t } = useTranslation();
  usePageSeo({
    title: t("contactPage.seoTitle"),
    description: t("contactPage.seoDescription"),
    path: "/contact",
  });
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF6EF] text-slate-900 dark:bg-[#09090b] dark:text-zinc-100">
      <LandingSiteHeader
        {...guestSiteHeaderChromeProps}
        className="!bg-[#FAF6EF] dark:!bg-background"
      />
      <main className="flex-1 px-4 pb-12 pt-8">
        <ContactUsContent />
      </main>
      <Footer />
    </div>
  );
}
