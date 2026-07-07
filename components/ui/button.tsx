import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  success?: boolean;
}

export function Button({
  className,
  variant = "primary",
  loading = false,
  success = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  let statusIcon: React.ReactNode = null;
  if (loading) {
    statusIcon = <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />;
  } else if (success) {
    statusIcon = <Check className="h-4 w-4 shrink-0" aria-hidden />;
  }

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
        "active:scale-[0.98] active:transition-transform",
        "disabled:pointer-events-none disabled:opacity-50",
        success &&
          variant === "primary" &&
          "bg-green-600 text-white hover:bg-green-600",
        success &&
          variant === "secondary" &&
          "border-green-300 bg-green-50 text-green-800 hover:bg-green-50",
        !success &&
          variant === "primary" &&
          "bg-teal-700 text-white hover:bg-teal-800",
        !success &&
          variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
        !success && variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {statusIcon}
      {children}
    </button>
  );
}
