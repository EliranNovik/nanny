import { useState } from "react";
import { Briefcase, Bell } from "lucide-react";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function UnifiedJobsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "jobs");

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        
        {/* Pro Segmented Control Tab Switcher */}
        <div className="flex items-center justify-center mb-10 mt-2">
          <div className="flex p-1.5 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md rounded-[20px] border border-black/5 dark:border-white/5 shadow-inner">
            <button
              onClick={() => setActiveTab("jobs")}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-[14px] text-sm font-bold transition-all duration-300",
                activeTab === "jobs"
                  ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              <Briefcase className={cn("w-4 h-4 transition-colors", activeTab === "jobs" ? "text-orange-500" : "text-slate-400")} />
              Live Jobs
            </button>
            
            <button
              onClick={() => setActiveTab("requests")}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-[14px] text-sm font-bold transition-all duration-300",
                activeTab === "requests"
                  ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              <Bell className={cn("w-4 h-4 transition-colors", activeTab === "requests" ? "text-orange-500" : "text-slate-400")} />
              Requests
            </button>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === "jobs" ? <JobsTabContent /> : <RequestsTabContent />}
        </div>
      </div>
    </div>
  );
}
