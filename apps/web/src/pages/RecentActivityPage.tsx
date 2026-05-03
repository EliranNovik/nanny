import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  DiscoverHomeRecentActivity,
  type DiscoverHomeRecentActivityViewer,
} from "@/components/discover/DiscoverHomeRecentActivity";
import { PageFrame, PageHeader } from "@/components/page-frame";

export default function RecentActivityPage() {
  const { profile } = useAuth();

  const viewerRole: DiscoverHomeRecentActivityViewer = useMemo(
    () => (profile?.role === "freelancer" ? "freelancer" : "client"),
    [profile?.role],
  );

  return (
    <PageFrame>
      <div className="app-desktop-shell space-y-6 pb-24 pt-8 md:pb-8">
        <PageHeader
          title="Recent activity"
          description="Reviews you received, comments on your posts, and hire interest in one place."
        />
        <DiscoverHomeRecentActivity
          viewerRole={viewerRole}
          limit={100}
          variant="table"
          showHeading={false}
        />
      </div>
    </PageFrame>
  );
}
