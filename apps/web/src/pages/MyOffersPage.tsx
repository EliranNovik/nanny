import { ExploreMyPostedOffers } from "@/components/discover/ExploreMyPostedOffers";
import { PageFrame, PageHeader } from "@/components/page-frame";

export default function MyOffersPage() {
  return (
    <PageFrame>
      <div className="app-desktop-shell space-y-6 pb-24 pt-8 md:pb-8">
        <PageHeader
          title="My offers"
          description="Service offers you’ve posted."
        />
        <ExploreMyPostedOffers variant="page" />
      </div>
    </PageFrame>
  );
}
