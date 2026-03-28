import { Baby, Sparkles, Truck, ChefHat, HelpCircle, CheckCircle2, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface JobCategory {
  id: string;
  title: string;
  description: string;
  modalDetails: string;
  benefits: string[];
  ctaText: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  image: string;
}

const categories: JobCategory[] = [
  {
    id: "childcare",
    title: "Childcare",
    description: "Meet trusted nannies and babysitters who feel right for your family.",
    modalDetails: "Our childcare professionals are rigorously vetted, experienced, and passionate about children. Whether you need a full-time returning nanny, an after-school sitter, or emergency backup care, we’ve got you covered with a seamless booking experience and thoroughly screened caregivers.",
    benefits: ["Verified background checks & reviews", "CPR & First Aid certified options", "Available on short notice", "Flexible scheduling tailored to you"],
    ctaText: "Hire a Nanny",
    icon: Baby,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-100",
    image: "/nanny-mar22.png",
  },
  {
    id: "cleaning",
    title: "Cleaning",
    description: "Keep your home fresh and tidy, from quick touch-ups to deep cleans.",
    modalDetails: "Experience a spotless home with our top-tier cleaning services. Our helpers use professional-grade techniques to ensure every corner of your house shines, giving you back your precious weekend time. We make the matching process instant and hassle-free.",
    benefits: ["Standard and deep cleaning options", "Eco-friendly products upon request", "Move-in / Move-out specials", "100% Satisfaction guaranteed"],
    ctaText: "Hire a Cleaner",
    icon: Sparkles,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-100",
    image: "/cleaning-mar22.png",
  },
  {
    id: "pickup",
    title: "Pick-up & Delivery",
    description: "From A to B – groceries, packages, and essentials delivered right when you need them.",
    modalDetails: "Forget traffic and lines. Our reliable helpers will pick up your groceries, packages, dry cleaning, or any other items and deliver them straight to your door, safely and on time. We ensure the fastest matching so your errands are complete within hours, not days.",
    benefits: ["Real-time status updates", "Careful handling of fragile items", "Contactless delivery available", "Fast, efficient, and direct point-to-point"],
    ctaText: "Hire a Courier",
    icon: Truck,
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
    image: "/other-mar22.png",
  },
  {
    id: "cooking",
    title: "Cooking",
    description: "Find home cooks and chefs for daily meals, meal prep, or fun cook-together evenings.",
    modalDetails: "Enjoy healthy, home-cooked meals without the hassle. Hire a talented home cook or professional chef to prepare weekly meals, cater a small dinner party, or even teach you new recipes. Our platform allows you to browse specific dietary specialties in just a few taps.",
    benefits: ["Customizable menus & dietary accommodations", "Grocery shopping included if needed", "Kitchen cleanup after cooking", "Restaurant-quality dining at home"],
    ctaText: "Hire a Chef",
    icon: ChefHat,
    iconColor: "text-pink-600",
    bgColor: "bg-pink-100",
    image: "/cooking-mar22.png",
  },
  {
    id: "other_help",
    title: "Other help",
    description: "Need something else? We match you with versatile helpers for any home task.",
    modalDetails: "Some tasks just don't fit into a box. Need help organizing a chaotic garage, assembling flat-pack furniture, packing boxes, or planning a small event? Our versatile network of helpers is ready to tackle your unique to-do list quickly and smoothly.",
    benefits: ["Diverse skill sets available on demand", "Hourly or project-based flexible rates", "Creative problem solvers", "Quick turnaround for any unique task"],
    ctaText: "Find a Helper",
    icon: HelpCircle,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
    image: "/other-mar22.png",
  },
];

export default function JobCategories() {
  const navigate = useNavigate();

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 md:px-0">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Dialog key={category.id}>
              <DialogTrigger asChild>
                <div
                  className="bg-card rounded-[2.5rem] p-6 border border-slate-100 shadow-sm hover:shadow-2xl hover:bg-card transition-all duration-700 flex items-center justify-between group overflow-hidden cursor-pointer"
                >
                  <div className="flex-1 pr-6 flex flex-col items-start text-left">
                    {/* Icon and Title Section */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-inner",
                        category.bgColor
                      )}>
                        <Icon className={cn("w-5 h-5", category.iconColor)} />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-primary transition-colors">
                        {category.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[240px]">
                      {category.description}
                    </p>
                  </div>

                  {/* Category Image - "Box Sized" */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden flex-shrink-0 border border-black/5 shadow-inner">
                    <img
                      src={category.image}
                      alt={category.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-primary/10 transition-colors duration-700" />
                  </div>
                </div>
              </DialogTrigger>

              <DialogContent className="w-full h-[100dvh] max-w-none sm:max-w-2xl p-0 overflow-hidden border-none rounded-none sm:rounded-[2.5rem] bg-card shadow-2xl flex flex-col sm:h-auto max-h-[100dvh] sm:max-h-[90vh]">
                {/* Close Button */}
                <DialogClose className="absolute right-4 top-4 md:right-6 md:top-6 z-50 p-2.5 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-colors focus:outline-none">
                  <X className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>

                {/* Full Bleed Image Header */}
                <div className="relative h-64 md:h-80 w-full flex-shrink-0">
                  <img src={category.image} alt={category.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-8 md:p-10">
                    <div className="flex items-center gap-3 mb-2 opacity-90 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
                      <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center backdrop-blur-md bg-white/20")}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white/90 text-sm font-bold tracking-widest uppercase">Service Overview</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight animate-in fade-in slide-in-from-bottom-5 duration-700">
                      {category.title}
                    </h2>
                  </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="p-8 md:p-10 space-y-8 overflow-y-auto">
                  <p className="text-slate-600 text-lg md:text-xl font-medium leading-relaxed">
                    {category.modalDetails}
                  </p>

                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 space-y-5">
                    <h3 className="text-xl font-bold text-slate-900">What makes our {category.title} help the best?</h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {category.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-3 text-slate-700">
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="font-semibold">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                      Ready to get started?
                    </p>
                    <Button
                      onClick={() => navigate('/onboarding?role=client')}
                      className="w-full sm:w-auto rounded-full px-8 h-12 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 flex items-center gap-2 group"
                    >
                      {category.ctaText}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
      <p className="text-center text-slate-400 font-bold tracking-widest text-xs uppercase opacity-50 flex items-center justify-center gap-2">

      </p>
    </div>
  );
}
