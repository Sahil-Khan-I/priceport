import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  accent: "bg-pp-accent/10 text-pp-accent",
  success: "bg-pp-success/15 text-emerald-700",
  warn: "bg-pp-highlight/30 text-amber-800",
  coral: "bg-pp-coral/12 text-pp-coral",
  muted: "bg-pp-bg-secondary text-pp-muted",
  dark: "bg-white/10 text-white/80",
  lavender: "bg-pp-lavender/20 text-indigo-800",
} as const;

type Tone = keyof typeof tones;

type BadgeProps = {
  children: ReactNode;
  tone?: Tone | string;
  className?: string;
};

export default function Badge({
  children,
  tone = "muted",
  className,
}: BadgeProps) {
  const toneClass = (tones as Record<string, string>)[tone] || tones.muted;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium tracking-wide",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
