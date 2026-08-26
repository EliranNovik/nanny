import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
import { AboutUsContent } from "@/components/AboutUsContent";
import { Footer } from "@/components/Footer";
import { usePageSeo } from "@/lib/seo";

export default function AboutPage() {
  usePageSeo({
    title: "About Us",
    description:
      "Tebnu is a softer way for families and helpers to find each other nearby — for home, kids, cooking, errands, and everyday help.",
    path: "/about",
  });
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <LandingSiteHeader {...guestSiteHeaderChromeProps} />
      <main className="flex-1 px-4 pb-12 pt-8">
        <AboutUsContent />
      </main>
      <Footer />
    </div>
  );
}
