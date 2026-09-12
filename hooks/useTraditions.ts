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
) {
  try {
    const res = await fetch("/api/traditions");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login"; return; }
      console.error("Failed to load traditions:", res.status);
      if (gen === genRef.current) setLoading(false);
      return;
    }
    const data = await res.json();
    if (gen === genRef.current) { setData(data); setLoading(false); }
  } catch (e) {
    console.error("Failed to load traditions:", e);
    if (gen === genRef.current) setLoading(false);
  }
}

export function useTraditions() {
  const [data, setData] = useState<TraditionsData>({ traditions: [], edges: [], people: [] });
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(() => {
    const gen = ++genRef.current;
    fetchTraditions(gen, genRef, setData, setLoading);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { traditions: data.traditions, traditionEdges: data.edges, traditionPeople: data.people, loading, reload: load };
}
