import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { LogOut } from "lucide-react";
import { logout, useAuth } from "wasp/client/auth";

function userInitials(email: string | undefined): string {
  return (email ?? "?")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserProfileMenu() {
  const { data: user } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = userInitials(user?.email ?? undefined);
  const displayName = user?.email?.split("@")[0] ?? "Account";

  async function onLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white ring-2 ring-transparent hover:ring-primary-100 data-popup-open:ring-primary-200"
        aria-label="Account menu"
      >
        {initials || "?"}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="w-56 origin-(--transform-origin) rounded-xl border border-neutral-200 bg-white p-1 shadow-lg outline-hidden data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 transition-[transform,opacity] duration-150">
            <div className="border-b border-neutral-100 px-3 py-2.5">
              <div className="truncate text-sm font-semibold text-neutral-900">{displayName}</div>
              <div className="truncate text-xs text-neutral-500">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <LogOut className="size-4 text-neutral-500" aria-hidden />
              Log out
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
