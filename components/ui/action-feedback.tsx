import { cn } from "@/lib/utils";

export function ActionFeedback({
  type,
  children,
  className,
}: {
  type: "success" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        type === "success" &&
          "border-hs-border bg-white text-hs-navy",
        type === "error" && "border-red-200 bg-red-50 text-red-800",
        className
      )}
    >
      {children}
    </div>
  );
}
