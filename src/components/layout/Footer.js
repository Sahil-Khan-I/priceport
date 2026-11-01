import Image from "next/image";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { SITE } from "@/lib/constants";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/market-lens", label: "Market Lens" },
      { href: "/investigation", label: "Investigation Room" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#features", label: "Features" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#tinyfish", label: "About TinyFish" },
      { href: "mailto:hello@priceport.app", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Privacy" },
      { href: "#", label: "Terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-pp-border bg-pp-bg-secondary">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/brand/logo.svg" alt="" width={28} height={28} />
              <span className="font-semibold tracking-tight text-pp-text">
                {SITE.name}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-pp-muted">
              Autonomous web investigations for global price intelligence.
              TinyFish agents investigate. Priceport turns findings into deals
              you can actually book.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-pp-muted">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-pp-text/80 transition-colors hover:text-pp-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-pp-border pt-6 text-sm text-pp-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Priceport. {SITE.tagline}</p>
          <p>Built around live web investigation — not search results alone.</p>
        </div>
      </Container>
    </footer>
  );
}
