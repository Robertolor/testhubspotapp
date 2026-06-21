"use client";

import { cn } from "@/lib/utils";

export interface CatalogListItem {
  id: string;
  label: string;
  name: string;
  type: string;
  detail?: string;
  badge?: string;
  muted?: boolean;
}

interface MappingCatalogPanelProps {
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  items: CatalogListItem[];
  totalCount: number;
  emptyMessage?: string;
  placeholder?: string;
}

export function MappingCatalogPanel({
  title,
  description,
  search,
  onSearchChange,
  loading,
  error,
  items,
  totalCount,
  emptyMessage = "No fields match your search.",
  placeholder = "Search by name, label, or type…",
}: MappingCatalogPanelProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading || Boolean(error)}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50"
        />
        <p className="mt-2 text-xs text-slate-500">
          {loading
            ? "Loading…"
            : error
              ? "—"
              : `Showing ${items.length} of ${totalCount}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <ul className="space-y-2 p-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="h-14 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </ul>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border border-transparent px-3 py-2",
                  item.muted ? "bg-slate-50" : "hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.label}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">
                      {item.name}
                    </p>
                  </div>
                  {item.badge ? (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.type}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function filterCatalogItems(
  items: CatalogListItem[],
  query: string
): CatalogListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      (item.detail?.toLowerCase().includes(q) ?? false) ||
      (item.badge?.toLowerCase().includes(q) ?? false)
  );
}
