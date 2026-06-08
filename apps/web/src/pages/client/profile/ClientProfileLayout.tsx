import { Outlet } from "react-router-dom";
import { useClientProfileForm } from "@/hooks/useClientProfileForm";
import { useScrollToTopOnPathnameChange } from "@/hooks/useScrollToTopOnPathnameChange";

export default function ClientProfileLayout() {
  const form = useClientProfileForm();
  useScrollToTopOnPathnameChange();
  return <Outlet context={form} />;
}
