import { useEffect, useId, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { cn } from "cn";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  joinDatetimeLocal,
  splitDatetimeLocal,
} from "../dateUtils";
import { Calendar, monthForPicker } from "./Calendar";

export const DATE_PICKER_TRIGGER_CLASS =
  "flex h-10 w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500 data-popup-open:border-primary-500 data-popup-open:ring-1 data-popup-open:ring-primary-500";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  /** `date` → `YYYY-MM-DD`; `datetime` → `YYYY-MM-DDTHH:mm` (datetime-local). */
  mode?: "date" | "datetime";
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  className,
  id: idProp,
  placeholder = "Pick a date",
  mode = "date",
}: DatePickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthForPicker(value));

  const datePart = mode === "datetime" ? splitDatetimeLocal(value).date : value.slice(0, 10);
  const timePart = mode === "datetime" ? splitDatetimeLocal(value).time : "09:00";

  useEffect(() => {
    if (open) setViewMonth(monthForPicker(value));
  }, [open, value]);

  const display =
    mode === "datetime"
      ? value
        ? formatDisplayDateTime(value)
        : ""
      : value
        ? formatDisplayDate(value)
        : "";

  function onSelectDate(iso: string) {
    if (mode === "datetime") {
      onChange(joinDatetimeLocal(iso, timePart));
    } else {
      onChange(iso);
      setOpen(false);
    }
  }

  function onTimeChange(time: string) {
    const date = datePart || toTodayIso();
    onChange(joinDatetimeLocal(date, time));
  }

  return (
    <div className="relative w-full">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          type="button"
          id={id}
          disabled={disabled}
          className={cn(DATE_PICKER_TRIGGER_CLASS, disabled && "cursor-not-allowed opacity-60", className)}
        >
          <CalendarDays className="size-4 shrink-0 text-neutral-400" aria-hidden />
          <span className={cn("min-w-0 flex-1 truncate", !display && "text-neutral-400")}>
            {display || placeholder}
          </span>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-50">
            <Popover.Popup className="w-[min(100vw-2rem,20rem)] origin-(--transform-origin) rounded-xl border border-neutral-200 bg-white shadow-lg outline-hidden data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 transition-[transform,opacity] duration-150">
              <Calendar
                viewMonth={viewMonth}
                onViewMonthChange={setViewMonth}
                selected={datePart || undefined}
                onSelect={onSelectDate}
                min={min}
                max={max}
              />
              {mode === "datetime" && (
                <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2.5">
                  <label htmlFor={`${id}-time`} className="text-xs font-medium text-neutral-500">
                    Time
                  </label>
                  <input
                    id={`${id}-time`}
                    type="time"
                    value={timePart}
                    onChange={(e) => onTimeChange(e.target.value)}
                    className="ml-auto rounded-md border border-neutral-200 px-2 py-1 text-sm text-neutral-800"
                  />
                </div>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          required
          readOnly
          onChange={() => {}}
        />
      )}
    </div>
  );
}

function toTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
