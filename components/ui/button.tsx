import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary" &&
          "bg-teal-700 text-white hover:bg-teal-800",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        className
      )}
      {...props}
    />
  );
}
