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

    const keepFocus = (event: Event) => {
      if (isGooglePlacesPacTarget(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("pointerdown", keepFocus, true);
    document.addEventListener("mousedown", keepFocus, true);
    document.addEventListener("touchstart", keepFocus, true);
    return () => {
      document.removeEventListener("pointerdown", keepFocus, true);
      document.removeEventListener("mousedown", keepFocus, true);
      document.removeEventListener("touchstart", keepFocus, true);
    };
  }, [active]);
}
