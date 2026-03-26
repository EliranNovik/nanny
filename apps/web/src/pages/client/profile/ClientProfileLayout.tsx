import { Outlet } from "react-router-dom";
import { useClientProfileForm } from "@/hooks/useClientProfileForm";

export default function ClientProfileLayout() {
  const form = useClientProfileForm();
  return <Outlet context={form} />;
}
