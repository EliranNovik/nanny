import {
  guestSiteHeaderChromeProps,
  LandingSiteHeader,
} from "@/components/LandingSiteHeader";
import { ContactUsContent } from "@/components/ContactUsContent";
import { Footer } from "@/components/Footer";
import { usePageSeo } from "@/lib/seo";

export default function ContactPage() {
  usePageSeo({
    title: "Contact",
    description: "Get in touch with the Tebnu team at info@tebnu.com.",
    path: "/contact",
  });
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
