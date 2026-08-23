import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
import { AboutUsContent } from "@/components/AboutUsContent";
import { Footer } from "@/components/Footer";

export default function AboutPage() {
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
