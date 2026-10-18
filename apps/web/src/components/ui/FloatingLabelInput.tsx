import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export interface FloatingLabelInputProps extends InputProps {
  label: string;
}

export const FloatingLabelInput = React.forwardRef<
  HTMLInputElement,
  FloatingLabelInputProps
>(({ id, label, className, value, defaultValue, ...props }, ref) => {
  const filled =
    (value != null && String(value).length > 0) ||
    (defaultValue != null && String(defaultValue).length > 0);

  return (
    <div className="relative">
      <Input
        id={id}
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        placeholder=" "
        className={cn(
          "peer h-14 rounded-xl border-2 bg-background px-4 pt-5 text-base shadow-none placeholder:text-transparent focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute start-3 z-10 origin-start bg-background px-1 text-muted-foreground transition-all duration-200",
          filled
            ? "top-0 -translate-y-1/2 text-[11px] font-semibold"
            : "top-1/2 -translate-y-1/2 text-base",
          "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-primary",
          "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold",
        )}
      >
        {label}
      </label>
    </div>
  );
});
FloatingLabelInput.displayName = "FloatingLabelInput";
