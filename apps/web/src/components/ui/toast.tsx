import * as React from "react";
import { X, CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({
  title,
  description,
  variant = "default",
  onClose,
  action,
}: ToastProps) {
  const icons = {
    default: Info,
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const Icon = icons[variant];

  const variantStyles = {
    default:
      "border-orange-200 bg-card shadow-orange-500/5 dark:border-orange-500/30 dark:bg-card",
    success:
      "border-emerald-200 bg-card/95 backdrop-blur-md shadow-emerald-500/10 dark:border-emerald-500/30 dark:bg-card/95",
    error:
      "border-red-200 bg-card shadow-red-500/5 dark:border-red-500/30 dark:bg-card",
    warning:
      "border-amber-200 bg-card shadow-amber-500/5 dark:border-amber-500/30 dark:bg-card",
    info: "border-blue-200 bg-card shadow-blue-500/5 dark:border-blue-500/30 dark:bg-card",
  }[variant];

  const iconColor = {
    default: "text-orange-500",
    success: "text-emerald-500",
    error: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  }[variant];

  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all",
        variantStyles,
      )}
    >
      <div className="flex items-start gap-3 flex-1">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
        <div className="flex-1 space-y-1">
          {title && (
            <p className="text-sm font-semibold text-black dark:text-white">
              {title}
            </p>
          )}
          {description && (
            <p className="text-sm text-black/70 dark:text-white/80">
              {description}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-xs font-semibold text-orange-500 hover:underline dark:text-orange-400"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-md p-1 text-black/30 opacity-0 transition-opacity hover:text-black focus:opacity-100 focus:outline-none group-hover:opacity-100 dark:text-white/45 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "id" | "onClose">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback(
    (toast: Omit<ToastProps, "id" | "onClose">) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: ToastProps = {
        ...toast,
        id,
        duration: toast.duration || 3000,
        onClose: () => removeToast(id),
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto remove after duration
      if (newToast.duration) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }: { toasts: ToastProps[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
