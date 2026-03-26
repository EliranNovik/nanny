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
        
        {/* Sticky segmented tabs under header on all screen sizes */}
        <div className="sticky top-14 z-30 mb-8 mt-1 py-1">
          <div className="flex p-1.5 bg-background/60 dark:bg-zinc-900/55 backdrop-blur-sm rounded-[24px] border border-primary/15 max-w-full overflow-x-auto no-scrollbar">
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
                        ? "bg-orange-500 text-white scale-[1.03] shadow-sm"
                        : "text-slate-500 hover:text-foreground dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-white" : "text-slate-400 dark:text-slate-400")} />
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
