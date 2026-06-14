import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AboutUsContent } from "@/components/AboutUsContent";
import { Footer } from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <div className="max-md:px-4 max-md:pt-4">
        <LandingSiteHeader
          hideLeftLogo
          mobileMatchLanding
          hideBackButtonMobile
          className="max-w-5xl !mb-0"
        />
      </div>
      <main className="flex-1 max-md:pt-2 md:pt-36 px-4 pb-12">
        <AboutUsContent />
      </main>
      <Footer />
    </div>
  );
}
