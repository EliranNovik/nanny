import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function ProfileHubLogoutButton() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={() => void signOut()}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {t("common.logOut")}
    </Button>
  );
}
