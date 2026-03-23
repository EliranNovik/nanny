import { Target, ShieldCheck, Star, Languages, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const benefits = [
  {
    title: "Ideal helper, faster",
    description: "AI matching shows you the best helpers first, ensuring a perfect fit.",
    icon: <Target className="w-8 h-8 text-blue-500" />,
    color: "bg-blue-50/80",
    angle: -90 // Top
  },
  {
    title: "Trust powered by AI",
    description: "Every helper is ID‑verified with Teudat Zehut and selfie-match.",
    icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
    color: "bg-emerald-50/80",
    angle: -18 // Top Right
  },
  {
    title: "Real reviews",
    description: "Ratings come only from real families after a job is completed.",
    icon: <Star className="w-8 h-8 text-yellow-500" />,
    color: "bg-yellow-50/80",
    angle: 54 // Bottom Right
  },
  {
    title: "No language barriers",
    description: "Hebrew, English, Russian – built for smooth communication.",
    icon: <Languages className="w-8 h-8 text-purple-500" />,
    color: "bg-purple-50/80",
    angle: 126 // Bottom Left
  },
  {
    title: "Built for busy families",
    description: "AI handles the hard stuff, making finding help stress‑free.",
    icon: <Zap className="w-8 h-8 text-orange-500" />,
    color: "bg-orange-50/80",
    angle: 198 // Top Left
  }
];

export default function Benefits() {
  return (
    <section className="py-24 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-24 text-black">
          Your benefits with Mamalama
        </h2>
        
        {/* Desktop Circular Layout - 800px scale */}
        <div className="hidden xl:block relative w-[800px] h-[800px] mb-20">
          {/* Central Anchor Image (Transparent) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 z-10 flex items-center justify-center p-4">
             <img 
               src="/ChatGPT Image Jan 27, 2026, 05_31_05 PM.png" 
               alt="Mamalama" 
               className="w-full h-full object-contain filter drop-shadow-2xl animate-pulse-subtle" 
             />
          </div>

          {/* Benefit Items */}
          {benefits.map((benefit, idx) => {
            const radius = 340; // Increased radius for better spacing
            const x = radius * Math.cos((benefit.angle * Math.PI) / 180);
            const y = radius * Math.sin((benefit.angle * Math.PI) / 180);

            return (
              <div
                key={idx}
                className="absolute w-[300px] transition-all duration-700 group"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={cn(
                    "w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-xl border border-white/40 backdrop-blur-sm",
                    benefit.color
                  )}>
                    {benefit.icon}
                  </div>
                  <div className="transition-transform duration-500 group-hover:-translate-y-2">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                      {benefit.title}
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed mt-2 max-w-[240px] mx-auto opacity-80 group-hover:opacity-100 transition-opacity font-medium">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Decorative Rings */}
          <div className="absolute inset-0 border-[2px] border-dashed border-primary/5 rounded-full scale-95 pointer-events-none" />
          <div className="absolute inset-0 border-[1px] border-dashed border-primary/10 rounded-full scale-105 pointer-events-none rotate-45" />
        </div>

        {/* Mobile/Tablet/Standard Grid Layout */}
        <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-16 w-full max-w-4xl px-8">
          {benefits.map((benefit, idx) => (
            <div
              key={idx}
              className="flex items-start gap-8 group transition-all"
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl md:rounded-[2rem] flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-lg border border-white/20",
                benefit.color
              )}>
                 <div className="scale-125">{benefit.icon}</div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">
                  {benefit.title}
                </h3>
                <p className="text-base text-gray-600 leading-relaxed font-medium">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 4s ease-in-out infinite;
        }
      `}} />
    </section>
  );
}
