import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { SITE } from "@/lib/constants";

const links = [
  { href: "/search", label: "Search" },
  { href: "/market-lens", label: "Market Lens" },
  { href: "/tracks", label: "Tracks" },
  { href: "/#how-it-works", label: "How it works" },
];

export default function Footer() {
  return (
    <footer className="border-t border-pp-border bg-pp-bg">
      <Container className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image src="/brand/logo.svg" alt="" width={24} height={24} />
          <span className="text-sm font-semibold text-pp-text">{SITE.name}</span>
          <span className="hidden text-sm text-pp-muted sm:inline">
            · {SITE.tagline}
          </span>
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-pp-muted hover:text-pp-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
