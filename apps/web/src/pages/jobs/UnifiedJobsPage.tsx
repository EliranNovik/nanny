import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Bell } from "lucide-react";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";

import { useLocation } from "react-router-dom";

export default function UnifiedJobsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "jobs");

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-2xl mx-auto pt-8">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-14 w-full bg-white p-1.5 rounded-full border border-border shadow-md mb-8">
            <TabsTrigger
              value="jobs"
              className="flex-1 rounded-full h-full text-base font-semibold transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm gap-2 text-black/50 hover:text-black/80"
            >
              <Briefcase className="w-5 h-5" />
              Live Jobs
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex-1 rounded-full h-full text-base font-semibold transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm gap-2 text-black/50 hover:text-black/80"
            >
              <Bell className="w-5 h-5" />
              Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="animate-fade-in">
            <JobsTabContent />
          </TabsContent>

          <TabsContent value="requests" className="animate-fade-in">
            <RequestsTabContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
