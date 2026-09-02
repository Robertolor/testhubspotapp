"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

interface MappingFieldPickerProps {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MappingFieldPicker({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Search fields…",
}: MappingFieldPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(q) ||
            option.value.toLowerCase().includes(q) ||
            (option.detail?.toLowerCase().includes(q) ?? false)
        )
      : options;
    return list.slice(0, 40);
  }, [options, query]);

  return (
    <div className="relative min-w-0">
      <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <input
        type="text"
        value={open ? query : (selected?.label ?? value)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery(selected?.label ?? value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-brand-clay/20 placeholder:text-slate-400 focus:border-brand-clay focus:outline-none focus:ring-2 disabled:bg-slate-100"
      />
      {selected && !open ? (
        <p className="mt-1 truncate font-mono text-xs text-slate-500">
          {selected.value}
          {selected.detail ? ` · ${selected.detail}` : ""}
        </p>
      ) : null}
      {open && !disabled ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                    option.disabled && "cursor-not-allowed opacity-50",
                    option.value === value && "bg-stone-100 text-brand-ink"
                  )}
                  disabled={option.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="block font-mono text-xs text-slate-500">
                    {option.value}
                    {option.detail ? ` · ${option.detail}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
