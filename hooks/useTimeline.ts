"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person, HistoricalEvent, ProphecyLink, ScriptureRef } from "@/lib/types";

interface TimelineData {
  people: Person[];
  events: HistoricalEvent[];
  prophecyLinks: ProphecyLink[];
  eventRefs: ScriptureRef[];
}

const EMPTY: TimelineData = { people: [], events: [], prophecyLinks: [], eventRefs: [] };

async function fetchTimeline(
  gen: number,
  genRef: { current: number },
  setData: (d: TimelineData) => void,
  setLoading: (l: boolean) => void,
) {
  try {
    const res = await fetch("/api/timeline");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login"; return; }
      console.error("Failed to load timeline:", res.status);
      if (gen === genRef.current) setLoading(false);
      return;
    }
    const json = await res.json();
    if (gen === genRef.current) { setData(json); setLoading(false); }
  } catch (e) {
    console.error("Failed to load timeline:", e);
    if (gen === genRef.current) setLoading(false);
  }
}

export function useTimeline() {
  const [data, setData] = useState<TimelineData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(() => {
    const gen = ++genRef.current;
    fetchTimeline(gen, genRef, setData, setLoading);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...data, loading, reload: load };
}
