import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-pp-accent text-white shadow-[0_4px_0_0_#2f63c4,0_8px_16px_rgba(70,137,255,0.22)] hover:-translate-y-px hover:bg-pp-accent-hover hover:shadow-[0_5px_0_0_#2f63c4,0_10px_18px_rgba(70,137,255,0.26)] active:translate-y-[3px] active:shadow-[0_1px_0_0_#2f63c4,0_2px_6px_rgba(70,137,255,0.2)] disabled:translate-y-0 disabled:shadow-[0_2px_0_0_#9db9ea] focus-visible:outline-pp-accent",
  secondary:
    "bg-transparent text-pp-text border border-pp-border hover:border-pp-accent/40 hover:bg-pp-white focus-visible:outline-pp-accent",
  ghost:
    "bg-transparent text-pp-text hover:bg-pp-bg-secondary focus-visible:outline-pp-accent",
  dark: "bg-pp-white text-pp-dark hover:bg-pp-bg focus-visible:outline-pp-highlight",
} as const;

type Variant = keyof typeof variants;

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
  onClick?: () => void;
};

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    className,
  } = props;

  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium tracking-tight transition-[transform,box-shadow,background-color,border-color] duration-150 motion-reduce:transition-none motion-reduce:transform-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50",
    variants[variant] || variants.primary,
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} onClick={props.onClick}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButton;
  return (
    <button type={buttonProps.type || "button"} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
