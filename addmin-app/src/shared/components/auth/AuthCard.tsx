import { ReactNode } from "react";

// Frosted glass card used for every auth/onboarding step. `wide` switches to
// the larger layout used by the Add office / Onboarding / Setup review
// screens (Login Flow.dc.html panels 7-9).
export function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`auth-card ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <div className="auth-card-icon">{icon}</div>
      <h1 className="mb-2 text-center text-2xl font-semibold text-neutral-900">{title}</h1>
      {subtitle && <p className="mb-6 text-center text-sm text-neutral-600">{subtitle}</p>}
      {children}
      {footer && <div className="mt-5 text-center text-sm text-neutral-600">{footer}</div>}
    </div>
  );
}
