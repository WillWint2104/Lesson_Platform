/**
 * @file Button.tsx — the v2 rounded button language (design-language-v2 §5).
 *
 * One shape, two intents: `primary` (mint accent) and `ghost` (white + line
 * border). Grey is RESERVED for the disabled state (§2.5) — a disabled button
 * renders grey via the shared `.v2-btn:disabled` rule, never a faded mint.
 * A native <button>, so it keeps semantics, focus, and keyboard for free.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = ["v2-btn", `v2-btn--${variant}`, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
