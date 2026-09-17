"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Tradition, TraditionEdge, TraditionPerson } from "@/lib/types";

interface TraditionsData {
  traditions: Tradition[];
  edges: TraditionEdge[];
  people: TraditionPerson[];
}

async function fetchTraditions(
  gen: number,
  genRef: { current: number },
  setData: (d: TraditionsData) => void,
  setLoading: (l: boolean) => void,
  setError: (message: string | null) => void,
) {
  try {
    const res = await fetch("/api/traditions");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      console.error("Failed to load traditions:", res.status);
      if (gen === genRef.current) { setLoading(false); setError("Could not load traditions. Check your connection and retry."); }
      return;
    }
    const data = await res.json();
    if (gen === genRef.current) { setData(data); setLoading(false); }
  } catch (e) {
    console.error("Failed to load traditions:", e);
    if (gen === genRef.current) { setLoading(false); setError("Could not load traditions. Check your connection and retry."); }
  }
}

export function useTraditions() {
  const [data, setData] = useState<TraditionsData>({ traditions: [], edges: [], people: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const gen = ++genRef.current;
    fetchTraditions(gen, genRef, setData, setLoading, setError);
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    void fetchTraditions(gen, genRef, setData, setLoading, setError);
    const generation = genRef;
    return () => { generation.current++; };
  }, []);

  return { traditions: data.traditions, traditionEdges: data.edges, traditionPeople: data.people, loading, error, reload: load };
}
