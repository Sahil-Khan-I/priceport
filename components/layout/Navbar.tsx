"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/layout/MobileNavigation";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-pp-border/80 bg-[#FFFDF9]/92 shadow-[0_8px_30px_rgba(23,32,51,0.06)] backdrop-blur-md"
          : "border-transparent bg-[#FFFDF9]/70 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/logo.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-[15px] font-semibold tracking-tight text-pp-text">
            {SITE.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-pp-bg-secondary font-medium text-pp-text"
                    : "text-pp-muted hover:text-pp-text",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Button href="/search" className="px-4 py-2 text-[13px]">
            Compare prices
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-pp-border text-pp-text md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <div className="flex w-4 flex-col gap-1.5">
            <span
              className={cn(
                "block h-0.5 w-full bg-pp-text transition",
                open && "translate-y-[7px] rotate-45",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-full bg-pp-text transition",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-full bg-pp-text transition",
                open && "-translate-y-[7px] -rotate-45",
              )}
            />
          </div>
        </button>
      </div>

      <MobileNavigation open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
