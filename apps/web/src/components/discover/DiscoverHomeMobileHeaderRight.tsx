import { useTranslation } from "react-i18next";
import { MoreVertical } from "lucide-react";
import { requestDiscoverHomeQuickMoreOpen } from "@/lib/discoverHomeQuickMoreBridge";
import { discoverHeaderGlassIconBtnClass } from "@/lib/discoverHomeHeaderChrome";

export function DiscoverHomeMobileHeaderRight() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={requestDiscoverHomeQuickMoreOpen}
      className={discoverHeaderGlassIconBtnClass}
      aria-label={t("discover.moreActions", { defaultValue: "More discover actions" })}
    >
      <MoreVertical className="relative z-[1] h-6 w-6" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
