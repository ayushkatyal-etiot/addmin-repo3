import { ReactNode } from "react";

// Icon + title + subtitle row above each wide wizard panel (add office,
// onboarding checklist, setup review -- Login Flow.dc.html panels 7-9).
export function WizardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="relative z-10 mb-6 flex items-center gap-3">
      <div className="auth-panel-icon">{icon}</div>
      <div>
        <div className="text-2xl font-semibold text-neutral-900">{title}</div>
        {subtitle && <div className="text-sm text-neutral-600">{subtitle}</div>}
      </div>
    </div>
  );
}
