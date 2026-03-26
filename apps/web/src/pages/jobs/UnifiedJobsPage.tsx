import { useState } from "react";
import { Briefcase, Bell, ClipboardList, Hourglass, CheckCircle2 } from "lucide-react";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: 'my_requests', label: 'My Requests', icon: ClipboardList },
  { id: 'requests', label: 'Requests', icon: Bell },
  { id: 'pending', label: 'Pending Jobs', icon: Hourglass },
  { id: 'jobs', label: 'Live Jobs', icon: Briefcase },
  { id: 'past', label: 'Past Jobs', icon: CheckCircle2 },
];

export default function UnifiedJobsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "requests");

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-4xl mx-auto pt-8">
        
        {/* Pro Segmented Control Tab Switcher - Horizontal Scroll on Mobile */}
        <div className="flex items-center justify-center mb-10 mt-2">
          <div className="flex p-1.5 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-[24px] border border-black/5 dark:border-white/5 shadow-inner max-w-full overflow-x-auto no-scrollbar">
            <div className="flex min-w-max gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-[18px] text-sm font-bold transition-all duration-300 whitespace-nowrap",
                      isActive
                        ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm scale-[1.02]"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-orange-500" : "text-slate-400")} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {(activeTab === "jobs" || activeTab === "past") ? (
            <JobsTabContent activeTab={activeTab as any} />
          ) : (
            <RequestsTabContent activeTab={activeTab as any} />
          )}
        </div>
      </div>
    </div>
  );
}
