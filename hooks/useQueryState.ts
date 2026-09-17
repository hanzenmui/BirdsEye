"use client";
import { useCallback, useMemo, useSyncExternalStore, type SetStateAction } from "react";

const CHANGE = "birdseye:navigation";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(CHANGE, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(CHANGE, callback);
  };
}
const snapshot = () => window.location.search;
const serverSnapshot = () => "";

export function navigate(patch: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href === window.location.href) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new Event(CHANGE));
}

// One URL is the source of truth for refresh, shared links and browser Back.
export function useQueryState<T extends string | null>(key: string, fallback: T, replace = false) {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const value = (new URLSearchParams(search).get(key) ?? fallback) as T;
  const setValue = useCallback((next: SetStateAction<T>) => {
    const current = (new URLSearchParams(window.location.search).get(key) ?? fallback) as T;
    navigate({ [key]: typeof next === "function" ? next(current) : next }, replace);
  }, [key, fallback, replace]);
  return [value, setValue] as const;
}

export function useQueryBoolean(key: string, fallback: boolean) {
  const [raw, setRaw] = useQueryState<string>(key, fallback ? "1" : "0");
  const setValue = useCallback((next: SetStateAction<boolean>) => {
    setRaw(previous => (typeof next === "function" ? next(previous === "1") : next) ? "1" : "0");
  }, [setRaw]);
  return [raw === "1", setValue] as const;
}

export function useQuerySet(key: string, choices: readonly string[]) {
  const [raw, setRaw] = useQueryState<string>(key, "*");
  const decode = useCallback((value: string) => new Set(value === "*" ? choices : value.split("|").filter(item => choices.includes(item))), [choices]);
  const value = useMemo(() => decode(raw), [decode, raw]);
  const setValue = useCallback((next: SetStateAction<Set<string>>) => {
    setRaw(previous => {
      const result = typeof next === "function" ? next(decode(previous)) : next;
      return choices.every(item => result.has(item)) ? "*" : [...result].join("|") || "none";
    });
  }, [setRaw, choices, decode]);
  return [value, setValue] as const;
}
