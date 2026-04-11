import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  initial: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: string;
}

const sizes = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

// Deterministic color from initial — inline styles so they survive Tailwind purging
const COLORS = [
  "#4f46e5", // indigo-600
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // rose-600
  "#0d9488", // teal-600
  "#c026d3", // fuchsia-600
];

function getColor(initial: string) {
  return COLORS[initial.toUpperCase().charCodeAt(0) % COLORS.length];
}

export function Avatar({ initial, src, size = "md", className, color }: AvatarProps) {
  const bgColor = color ?? getColor(initial);
  const sizeClass = sizes[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={initial}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeClass,
          className
        )}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white uppercase select-none shrink-0",
        sizeClass,
        className
      )}
      aria-label={initial}
    >
      {initial.charAt(0)}
    </div>
  );
}
