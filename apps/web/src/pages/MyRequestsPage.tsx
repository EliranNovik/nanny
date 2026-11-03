import { ExploreMyPostedRequests } from "@/components/discover/ExploreMyPostedRequests";
import { PageFrame, PageHeader } from "@/components/page-frame";

export default function MyRequestsPage() {
  return (
    <PageFrame>
      <div className="app-desktop-shell space-y-6 pb-24 pt-8 md:pb-8">
        <PageHeader
          title="My requests"
          description="Open help requests you’ve posted."
        />
        <ExploreMyPostedRequests variant="page" />
      </div>
    </PageFrame>
  );
}
