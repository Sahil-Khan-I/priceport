"use client";

import { NAV_LINKS } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function MobileNavigation({ open, onClose }) {
  return (
    <div
      className={cn(
        "border-t border-pp-border bg-pp-bg md:hidden",
        open ? "block" : "hidden",
      )}
    >
      <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4" aria-label="Mobile">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="rounded-lg px-3 py-3 text-sm text-pp-text hover:bg-pp-bg-secondary"
          >
            {link.label}
          </a>
        ))}
        <div className="px-3 pt-3">
          <Button href="/search" className="w-full" onClick={onClose}>
            Start comparing
          </Button>
        </div>
      </nav>
    </div>
  );
}
