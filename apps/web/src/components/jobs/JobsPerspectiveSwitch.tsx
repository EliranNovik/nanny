import type { JobsPerspective } from "./jobsPerspective";

export function JobsPerspectiveSwitch({
  current,
  className,
}: {
  current: JobsPerspective;
  className?: string;
}) {
  // Hidden for now (removes "My Helpers / Helping others" text and the switch button on all tabs).
  void current;
  void className;
  return null;
}
