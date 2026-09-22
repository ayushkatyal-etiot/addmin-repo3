import { useState } from "react";
import { useNavigate } from "react-router";
import { Popover } from "@base-ui/react/popover";
import { useAuth } from "wasp/client/auth";
import { useQuery, listMyNotifications } from "wasp/client/operations";
import { cn } from "cn";

const ADMIN_NOTIFICATION_ROLES = new Set(["platform_admin", "office_admin"]);

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: items, isLoading, refetch } = useQuery(listMyNotifications, undefined, {
    enabled: !!user,
  });

  const count = items?.length ?? 0;
  const badge = count > 9 ? "9+" : count > 0 ? String(count) : null;
  const showAdminLink = user?.role && ADMIN_NOTIFICATION_ROLES.has(user.role);

  function openItem(url: string | null) {
    setOpen(false);
    if (url) navigate(url);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refetch();
      }}
    >
      <Popover.Trigger
        type="button"
        aria-label={count ? `Notifications, ${count} recent` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 data-popup-open:bg-neutral-50"
      >
        <BellIcon />
        {badge && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="flex w-90 max-w-[calc(100vw-2rem)] origin-(--transform-origin) flex-col rounded-xl border border-neutral-200 bg-white shadow-lg outline-hidden data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 transition-[transform,opacity] duration-150">
            <div className="border-b border-neutral-100 px-4 py-3">
              <div className="text-sm font-semibold text-neutral-900">Notifications</div>
              <div className="text-xs text-neutral-500">Reminders and alerts sent to you</div>
            </div>

            <ul className="max-h-80 overflow-y-auto p-1" role="list">
              {isLoading && <li className="px-3 py-6 text-center text-sm text-neutral-500">Loading…</li>}

              {!isLoading && count === 0 && (
                <li className="px-3 py-8 text-center text-sm text-neutral-500">No notifications for your account yet.</li>
              )}

              {!isLoading &&
                items?.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item.url)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-neutral-50",
                        item.url && "cursor-pointer",
                        !item.url && "cursor-default",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-900">{item.title}</span>
                        <span className="shrink-0 text-[11px] text-neutral-400">{formatSentAt(item.sent_at)}</span>
                      </div>
                      <span className="text-xs text-neutral-600">{item.summary}</span>
                      {item.url && <span className="text-xs font-medium text-primary-600">View →</span>}
                    </button>
                  </li>
                ))}
            </ul>

            {showAdminLink && (
              <div className="border-t border-neutral-100 p-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate("/admin/notifications");
                  }}
                  className="w-full rounded-lg px-2 py-2 text-center text-xs font-semibold text-primary-700 hover:bg-neutral-50"
                >
                  Notification settings & org delivery log
                </button>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
