import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "brand" | "accent" | "success" | "warning" | "danger" | "info" | "live";
  size?: "sm" | "md";
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface-overlay text-foreground-muted border border-border",
  brand: "bg-brand-dim text-brand border border-brand/30",
  accent: "bg-amber-950/60 text-accent border border-accent/30",
  success: "bg-green-950/60 text-success border border-success/30",
  warning: "bg-amber-950/60 text-warning border border-warning/30",
  danger: "bg-red-950/60 text-danger border border-danger/30",
  info: "bg-sky-950/60 text-info border border-info/30",
  live: "bg-red-950/80 text-live border border-live/40",
};

const badgeSizes: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "h-5 px-1.5 text-[10px] gap-1",
  md: "h-6 px-2 text-xs gap-1.5",
};

export function Badge({ variant = "default", size = "md", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full whitespace-nowrap",
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    >
      {variant === "live" && (
        <span className="w-1.5 h-1.5 rounded-full bg-live animate-live-pulse" />
      )}
      {children}
    </span>
  );
}
