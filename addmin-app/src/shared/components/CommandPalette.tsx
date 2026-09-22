import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { filterNavSearchRoutes, NAV_SEARCH_ROUTES } from "../navSearch";
import { Dialog } from "./Dialog";

const UTILITIES_ROLES = new Set([
  "platform_admin",
  "office_admin",
  "office_head",
  "vendor_manager",
]);
const LEASES_ROLES = new Set(["platform_admin", "office_admin", "office_head", "payment_authorizer"]);
const VENDORS_ROLES = new Set(["platform_admin", "vendor_manager", "office_admin", "facility_staff"]);
const MAINTENANCE_ROLES = new Set(["platform_admin", "office_admin", "facility_staff", "employee"]);
const ASSETS_ADMIN_ROLES = new Set(["platform_admin", "office_admin"]);
const COMPLIANCE_ROLES = new Set(["platform_admin", "office_admin", "compliance_coordinator", "office_head"]);
const WORKFLOW_ADMIN_ROLES = new Set(["platform_admin", "office_admin"]);

function routeAllowed(prefix: string, role: string | null | undefined): boolean {
  if (!role) return false;
  if (prefix.startsWith("/app/utilities")) return UTILITIES_ROLES.has(role);
  if (prefix.startsWith("/app/property/leases")) return LEASES_ROLES.has(role);
  if (prefix.startsWith("/app/vendors")) return VENDORS_ROLES.has(role);
  if (prefix.startsWith("/app/maintenance")) return MAINTENANCE_ROLES.has(role);
  if (prefix.startsWith("/app/assets")) return ASSETS_ADMIN_ROLES.has(role);
  if (prefix.startsWith("/app/compliance")) return COMPLIANCE_ROLES.has(role);
  if (prefix.startsWith("/admin/")) return WORKFLOW_ADMIN_ROLES.has(role);
  return true;
}

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const allowedRoutes = useMemo(
    () => NAV_SEARCH_ROUTES.filter((r) => routeAllowed(r.prefix, user?.role)),
    [user?.role],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = filterNavSearchRoutes(query).filter((r) => allowedRoutes.some((a) => a.prefix === r.prefix));
    if (q) return filtered;
    return [...allowedRoutes].sort((a, b) => a.label.localeCompare(b.label));
  }, [query, allowedRoutes]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results.length]);

  function close() {
    onOpenChange(false);
  }

  function goTo(prefix: string) {
    navigate(prefix);
    close();
  }

  if (!open) return null;

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) goTo(target.prefix);
    }
  }

  return (
    <Dialog open={open} onClose={close} closeOnClickOutside={false} placement="center">
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={close}
        role="presentation"
      >
        <div
          className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-hidden placeholder:text-neutral-400"
          />
          <kbd className="hidden shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 sm:inline">
            esc
          </kbd>
        </div>

        <div className="px-2 py-2">
          <p className="px-2 py-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Quick actions</p>
          <ul ref={listRef} className="max-h-72 overflow-y-auto" role="listbox">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-neutral-500">No matching actions.</li>
            ) : (
              results.map((item, index) => (
                <li key={item.prefix} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goTo(item.prefix)}
                    className={`flex w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                      index === activeIndex ? "bg-primary-50 text-primary-900" : "text-neutral-800 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{item.label}</span>
                      <span
                        className={`mt-0.5 block text-xs leading-snug ${
                          index === activeIndex ? "text-primary-800/80" : "text-neutral-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
        </div>
      </div>
    </Dialog>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-neutral-400"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Global ⌘K / Ctrl+K — mount once in the app shell. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
