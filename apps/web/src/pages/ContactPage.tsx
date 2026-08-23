import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
import { ContactUsContent } from "@/components/ContactUsContent";
import { Footer } from "@/components/Footer";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <LandingSiteHeader {...guestSiteHeaderChromeProps} />
      <main className="flex-1 px-4 pb-12 pt-8">
        <ContactUsContent />
      </main>
      <Footer />
    </div>
  );
}
