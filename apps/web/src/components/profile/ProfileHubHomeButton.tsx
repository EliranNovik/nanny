import { Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function ProfileHubHomeButton() {
  const { t } = useTranslation();

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground"
    >
      <Link to="/">
        <Home className="h-4 w-4" aria-hidden />
        {t("common.home")}
      </Link>
    </Button>
  );
}
