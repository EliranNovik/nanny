import {
  Bell,
  Briefcase,
  ClipboardList,
  Hourglass,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { JobsPerspective } from "./jobsPerspective";

export type JobsTabConfigItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

/** Helping others — freelancer-side workflow */
export const FREELANCER_JOBS_TABS: readonly JobsTabConfigItem[] = [
  { id: "requests", label: "Community's requests", icon: Bell },
  { id: "pending", label: "Pending response", icon: Hourglass },
  { id: "jobs", label: "Helping now", icon: Briefcase },
  { id: "past", label: "History of help", icon: CheckCircle2 },
];

/** My Helpers — client-side workflow */
export const CLIENT_JOBS_TABS: readonly JobsTabConfigItem[] = [
  { id: "my_requests", label: "My Posted Requests", icon: ClipboardList },
  { id: "jobs", label: "Helping me now", icon: Briefcase },
  { id: "past", label: "History of help", icon: CheckCircle2 },
];

export function tabsForPerspective(mode: JobsPerspective): readonly JobsTabConfigItem[] {
  return mode === "client" ? CLIENT_JOBS_TABS : FREELANCER_JOBS_TABS;
}
