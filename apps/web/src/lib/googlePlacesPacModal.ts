import { useEffect } from "react";

/** True when the event target is inside Google's Places suggestion dropdown. */
export function isGooglePlacesPacTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(".pac-container, .pac-item"))
  );
}

/** True when the event target is inside our custom location picker menu. */
export function isLocationPickerMenuTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-location-picker-menu]"))
  );
}

/** Use on Radix `DialogContent` so outside suggestion clicks don't dismiss the dialog. */
export function preventDialogDismissForGooglePlacesPac(event: Event): void {
  if (
    isGooglePlacesPacTarget(event.target) ||
    isLocationPickerMenuTarget(event.target)
  ) {
    event.preventDefault();
  }
}

/**
 * In modals, mousedown on a pac item blurs the input before click — place_changed never fires.
 * Calling preventDefault on mousedown keeps focus until the selection completes.
 */
export function useGooglePlacesPacModalSupport(active = true): void {
  useEffect(() => {
    if (!active) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (isGooglePlacesPacTarget(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [active]);
}
