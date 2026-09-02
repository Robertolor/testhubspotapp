import Link from "next/link";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BillingRequiredNotice({
  href = "/billing",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <ActionFeedback type="error" className={cn("space-y-3", className)}>
      <p>Billing is not set up yet. Start a trial to sync.</p>
      <Link href={href}>
        <Button type="button" variant="secondary">
          Go to Billing
        </Button>
      </Link>
    </ActionFeedback>
  );
}
