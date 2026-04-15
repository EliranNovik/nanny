import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AboutUsContent } from "@/components/AboutUsContent";
import { Footer } from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <LandingSiteHeader leftCorner="back" />
      <main className="flex-1 pt-28 md:pt-36 px-4 pb-12">
        <AboutUsContent />
      </main>
      <Footer />
    </div>
  );
}
