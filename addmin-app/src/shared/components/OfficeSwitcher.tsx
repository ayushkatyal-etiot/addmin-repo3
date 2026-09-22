import { useState } from "react";
import { useNavigate } from "react-router";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "cn";
import { useSelectedOffice, type OfficeRow } from "../SelectedOfficeContext";
import { sentenceCase } from "../text";

const OFFICE_GRADIENTS = [
  "bg-linear-to-br from-emerald-400 to-emerald-600",
  "bg-linear-to-br from-green-500 to-green-700",
  "bg-linear-to-br from-teal-400 to-emerald-600",
  "bg-linear-to-br from-lime-500 to-green-600",
  "bg-linear-to-br from-emerald-600 to-teal-700",
  "bg-linear-to-br from-green-400 to-teal-500",
];

function gradientForOfficeId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % OFFICE_GRADIENTS.length;
  return OFFICE_GRADIENTS[hash]!;
}

function OfficeIcon({ officeId, size = "list" }: { officeId: string; size?: "trigger" | "list" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full shadow-xs ring-1 ring-black/5",
        gradientForOfficeId(officeId),
        size === "trigger" ? "size-5" : "size-6",
      )}
      aria-hidden
    />
  );
}

function officeSubtitle(office: OfficeRow) {
  const type = sentenceCase(office.office_type);
  if (office.setup_status !== "active") {
    return `${type} · ${sentenceCase(office.setup_status)}`;
  }
  return type;
}

export function OfficeSwitcher() {
  const navigate = useNavigate();
  const { offices, officeId, setOfficeId, hasOffices, selectedOffice } = useSelectedOffice();
  const [open, setOpen] = useState(false);

  const current = selectedOffice ?? offices?.find((o) => o.id === officeId);

  function pick(id: string) {
    setOfficeId(id);
    setOpen(false);
  }

  function goCreateOffice() {
    setOpen(false);
    navigate("/app/offices/new");
  }

  if (!hasOffices) {
    return (
      <button
        type="button"
        onClick={() => navigate("/app/offices/new")}
        className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
      >
        <span className="size-5 shrink-0 rounded-full bg-linear-to-br from-emerald-500 to-green-600 ring-1 ring-black/5" aria-hidden />
        <span>Add office</span>
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        className="flex h-9 max-w-65 min-w-0 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-100 data-popup-open:bg-neutral-100"
        aria-label="Switch office"
      >
        {current && <OfficeIcon officeId={current.id} size="trigger" />}
        <span className="min-w-0 flex-1 truncate">{current?.name ?? "Select office"}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-neutral-400" aria-hidden />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" className="z-50">
          <Popover.Popup className="w-80 origin-(--transform-origin) rounded-xl border border-neutral-200 bg-white p-1 shadow-lg outline-hidden data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 transition-[transform,opacity] duration-150">
            <div className="px-2 py-2 text-xs font-medium text-neutral-500">Offices</div>
            <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Offices">
              {(offices ?? []).map((office) => {
                const selected = office.id === officeId;
                return (
                  <li key={office.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(office.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-50",
                        selected && "bg-neutral-50",
                      )}
                    >
                      <OfficeIcon officeId={office.id} size="list" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-neutral-900">{office.name}</span>
                        <span className="block truncate text-xs text-neutral-500">{officeSubtitle(office)}</span>
                      </span>
                      {selected && <Check className="size-4 shrink-0 text-neutral-900" strokeWidth={2.5} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="my-1 border-t border-neutral-100" />
            <button
              type="button"
              onClick={goCreateOffice}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <Plus className="size-4 text-neutral-500" aria-hidden />
              Create office
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
