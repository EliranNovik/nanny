import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, Bell } from "lucide-react";
import JobsTabContent from "./JobsTabContent";
import RequestsTabContent from "./RequestsTabContent";

export default function UnifiedJobsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("jobs");

  return (
    <div className="min-h-screen gradient-mesh p-4 pb-32 md:pb-24">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Jobs & Requests</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-14 w-full bg-white/5 backdrop-blur-md p-1.5 rounded-full border-none shadow-none mb-8">
            <TabsTrigger
              value="jobs"
              className="flex-1 rounded-full h-full text-base font-semibold transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none gap-2 text-white/60"
            >
              <Briefcase className="w-5 h-5" />
              Live Jobs
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              className="flex-1 rounded-full h-full text-base font-semibold transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none gap-2 text-white/60"
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
