"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person, HistoricalEvent, ProphecyLink, ScriptureRef } from "@/lib/types";
import { DATA_CHANGED } from "@/lib/data-events";

interface TimelineData {
  people: Person[];
  events: HistoricalEvent[];
  prophecyLinks: ProphecyLink[];
  eventRefs: ScriptureRef[];
  personBooks: Record<string, string[]>;
}

const EMPTY: TimelineData = { people: [], events: [], prophecyLinks: [], eventRefs: [], personBooks: {} };

async function fetchTimeline(
  gen: number,
  genRef: { current: number },
  setData: (d: TimelineData) => void,
  setLoading: (l: boolean) => void,
  setError: (message: string | null) => void,
) {
  try {
    const res = await fetch("/api/timeline");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      console.error("Failed to load timeline:", res.status);
      if (gen === genRef.current) { setLoading(false); setError("Could not load timeline. Check your connection and retry."); }
      return;
    }
    const json = await res.json();
    if (gen === genRef.current) { setData(json); setLoading(false); }
  } catch (e) {
    console.error("Failed to load timeline:", e);
    if (gen === genRef.current) { setLoading(false); setError("Could not load timeline. Check your connection and retry."); }
  }
}

export function useTimeline() {
  const [data, setData] = useState<TimelineData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const gen = ++genRef.current;
    fetchTimeline(gen, genRef, setData, setLoading, setError);
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    void fetchTimeline(gen, genRef, setData, setLoading, setError);
    const generation = genRef;
    return () => { generation.current++; };
  }, []);

  useEffect(() => {
    window.addEventListener(DATA_CHANGED, load);
    return () => window.removeEventListener(DATA_CHANGED, load);
  }, [load]);

  return { ...data, loading, error, reload: load };
}
