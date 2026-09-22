import { ComponentProps } from "react";
import { ClassNameValue, twJoin } from "tailwind-merge";
import { Link } from "wasp/client/router";

// Matches the design system's Button.jsx spec (sizes: sm 32px / md 38px /
// lg 44px; variants: primary / secondary / ghost / danger) -- see
// Offices List.dc.html and the chat summary for where this got adopted.
type ButtonSize = "sm" | "md" | "lg";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ComponentProps<"button"> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  type = "button",
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ButtonLink({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}

function getButtonClasses({
  size,
  variant,
  className,
}: {
  size: ButtonSize;
  variant: ButtonVariant;
  className: ClassNameValue;
}): string {
  return twJoin(
    "inline-flex items-center justify-center gap-2 rounded-md border font-semibold outline-hidden transition-colors",
    "focus-visible:ring-4 focus-visible:ring-primary-100",
    "disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

const sizeStyles: Record<ButtonSize, ClassNameValue> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9.5 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

const variantStyles: Record<ButtonVariant, ClassNameValue> = {
  primary:
    "border-transparent bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100",
  ghost:
    "border-transparent bg-transparent text-neutral-900 hover:bg-neutral-100 active:bg-neutral-200",
  danger: "border-transparent bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};
