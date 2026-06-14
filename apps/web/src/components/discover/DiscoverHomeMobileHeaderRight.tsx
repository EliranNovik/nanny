import { useTranslation } from "react-i18next";
import { MoreVertical } from "lucide-react";
import { requestDiscoverHomeQuickMoreOpen } from "@/lib/discoverHomeQuickMoreBridge";
import { signedInHeaderIconBtnClass } from "@/lib/discoverHomeHeaderChrome";

export function DiscoverHomeMobileHeaderRight() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={requestDiscoverHomeQuickMoreOpen}
      className={signedInHeaderIconBtnClass}
      aria-label={t("discover.moreActions", { defaultValue: "More discover actions" })}
    >
      <MoreVertical className="h-7 w-7" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
