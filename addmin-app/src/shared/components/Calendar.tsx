import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import {
  addMonths,
  buildMonthGrid,
  formatDisplayDate,
  isDateDisabled,
  isSameDay,
  isSameMonth,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
} from "../dateUtils";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export type CalendarProps = {
  viewMonth: Date;
  onViewMonthChange: (month: Date) => void;
  selected?: string;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
};

export function Calendar({
  viewMonth,
  onViewMonthChange,
  selected,
  onSelect,
  min,
  max,
  className,
}: CalendarProps) {
  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  function prevMonth() {
    onViewMonthChange(addMonths(viewMonth, -1));
  }

  function nextMonth() {
    onViewMonthChange(addMonths(viewMonth, 1));
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-neutral-900">{monthLabel}</span>
        <button
          type="button"
          aria-label="Next month"
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-[11px] font-medium text-neutral-400">
            {d}
          </div>
        ))}
        {grid.map((day) => {
          const iso = toIsoDate(day);
          const inMonth = isSameMonth(day, viewMonth);
          const isSelected = selected === iso;
          const isToday = isSameDay(day, today);
          const disabled = isDateDisabled(iso, min, max);

          return (
            <button
              key={iso + (inMonth ? "" : "-pad")}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(iso)}
              aria-label={formatDisplayDate(iso)}
              aria-pressed={isSelected}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md text-sm font-medium transition-colors",
                !inMonth && "text-neutral-300",
                inMonth && !disabled && !isSelected && "text-neutral-800 hover:bg-neutral-100",
                disabled && "cursor-not-allowed text-neutral-300",
                isSelected && "bg-primary-500 text-white hover:bg-primary-600",
                isToday && !isSelected && inMonth && "ring-1 ring-primary-300 ring-inset",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function monthForPicker(value: string | undefined): Date {
  const iso = value?.includes("T") ? value.split("T")[0] : value;
  const parsed = iso ? parseIsoDate(iso) : null;
  if (parsed) return startOfMonth(parsed);
  return startOfMonth(new Date());
}
