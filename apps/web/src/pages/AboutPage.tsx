import { LandingSiteHeader } from "@/components/LandingSiteHeader";
import { AboutUsContent } from "@/components/AboutUsContent";
import Benefits from "@/components/Benefits";
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
    <div className="min-h-screen bg-[#FAF6EF] dark:bg-background flex flex-col">
      <LandingSiteHeader
        hideLeftLogo
        hideBackButton
        hideBackButtonMobile
        fullBleedTop
        className="!bg-[#FAF6EF] dark:!bg-background"
        hideContactAndLegal
      />
      <main className="flex-1 px-4 pb-4 pt-8">
        <AboutUsContent />
      </main>
      <div className="pb-16 pt-6 md:pb-24 md:pt-10">
        <Benefits />
      </div>
      <Footer />
    </div>
  );
}
