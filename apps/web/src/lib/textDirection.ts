import { cn } from "@/lib/utils";

/** Hebrew, Arabic, and related RTL scripts. */
const RTL_SCRIPT =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export type TextDirection = "rtl" | "ltr" | "auto";

export function isRtlText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  for (const char of text.trim()) {
    if (/\s/.test(char)) continue;
    if (RTL_SCRIPT.test(char)) return true;
    if (/[A-Za-z0-9]/.test(char)) return false;
  }
  return false;
}

export function textDirection(text: string | null | undefined): TextDirection {
  if (!text?.trim()) return "auto";
  return isRtlText(text) ? "rtl" : "ltr";
}

export function bidirectionalClass(
  text: string | null | undefined,
  extra?: string,
): string {
  const dir = textDirection(text);
  return cn(
    dir === "rtl" && "text-right",
    dir === "ltr" && "text-left",
    extra,
  );
}

/** Props for elements displaying user-generated text. */
export function bidirectionalTextProps(
  text: string | null | undefined,
  className?: string,
) {
  const dir = textDirection(text);
  return {
    dir,
    className: bidirectionalClass(text, className),
  } as const;
}

/** Props for text inputs that should follow typing direction. */
export function bidirectionalInputProps(
  value: string,
  className?: string,
) {
  const dir = value.trim() ? textDirection(value) : "auto";
  return {
    dir,
    className: cn(
      dir === "rtl" && "text-right",
      dir === "ltr" && "text-left",
      className,
    ),
  } as const;
}
