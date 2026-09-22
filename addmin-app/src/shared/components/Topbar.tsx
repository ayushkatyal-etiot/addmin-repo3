import { useLocation, useNavigate } from "react-router";
import { NotificationBell } from "./NotificationBell";
import { OfficeSwitcher } from "./OfficeSwitcher";
import { UserProfileMenu } from "./UserProfileMenu";

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = location.pathname !== "/app/dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-100 bg-white px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBack && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
          >
            <BackIcon />
          </button>
        )}
        <OfficeSwitcher />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <NotificationBell />
        <UserProfileMenu />
      </div>
    </header>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
