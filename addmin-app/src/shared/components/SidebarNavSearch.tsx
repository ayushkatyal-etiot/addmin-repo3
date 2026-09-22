import { useState } from "react";
import { CommandPalette, useCommandPaletteShortcut } from "./CommandPalette";

function paletteShortcutLabel(): string {
  if (typeof navigator === "undefined") return "⌘K";
  return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K";
}

export function SidebarNavSearch() {
  const [open, setOpen] = useState(false);
  const shortcut = paletteShortcutLabel();

  useCommandPaletteShortcut(() => setOpen(true));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-100"
      >
        <SearchIcon />
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-400">Search...</span>
        <kbd className="pointer-events-none shrink-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-sans text-[11px] font-medium tracking-tight text-neutral-500">
          {shortcut}
        </kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
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
