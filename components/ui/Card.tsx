import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "bordered" | "ghost";
  interactive?: boolean;
}

const cardVariants: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-surface border border-border",
  raised: "bg-surface-raised border border-border",
  bordered: "bg-transparent border border-border",
  ghost: "bg-transparent",
};

export function Card({ variant = "default", interactive, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[--radius-lg] overflow-hidden",
        cardVariants[variant],
        interactive && "cursor-pointer hover:border-brand/50 hover:bg-surface-raised transition-colors duration-150",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 pt-5 pb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-3 pt-3 border-t border-border", className)} {...props}>
      {children}
    </div>
  );
}
