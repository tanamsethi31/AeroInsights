import { useState, useMemo } from "react";
import type React from "react";

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string | null;
  dir: SortDir;
}

export function useSortable<T>(
  data: T[],
  accessors: Record<string, (item: T) => string | number>
) {
  const [sortState, setSortState] = useState<SortState>({ key: null, dir: "asc" });

  function toggleSort(key: string) {
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    const { key, dir } = sortState;
    if (!key || !accessors[key]) return data;
    const fn = accessors[key];
    return [...data].sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortState, accessors]);

  return { sorted, sortState, toggleSort };
}

export function sortIcon(col: string, sortState: SortState): string {
  if (sortState.key !== col) return "⇅";
  return sortState.dir === "asc" ? "↑" : "↓";
}

export function sortIconStyle(col: string, sortState: SortState): React.CSSProperties {
  return {
    marginLeft: "0.3rem",
    fontSize: "0.7rem",
    opacity: sortState.key === col ? 1 : 0.35,
    color: sortState.key === col ? "#002147" : "inherit",
  };
}
