import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary-foreground",
        // Tinted variants read better than solid fills in dense tables.
        success:
          "border-transparent bg-success/15 text-success-foreground dark:text-success",
        warning:
          "border-transparent bg-warning/15 text-warning-foreground dark:text-warning",
        danger:
          "border-transparent bg-destructive/15 text-destructive dark:text-destructive",
        info: "border-transparent bg-info/15 text-info dark:text-info",
        muted: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
