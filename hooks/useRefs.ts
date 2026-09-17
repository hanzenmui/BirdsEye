"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ScriptureRef } from "@/lib/types";

async function fetchRefs(
  gen: number,
  genRef: { current: number },
  setRefs: (r: ScriptureRef[]) => void,
  setLoading: (l: boolean) => void,
  setError: (message: string | null) => void,
) {
  try {
    const res = await fetch("/api/refs");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      console.error("Failed to load refs:", res.status);
      if (gen === genRef.current) { setLoading(false); setError("Could not load refs. Check your connection and retry."); }
      return;
    }
    const data = await res.json();
    if (gen === genRef.current) { setRefs(data); setLoading(false); }
  } catch (e) {
    console.error("Failed to load refs:", e);
    if (gen === genRef.current) { setLoading(false); setError("Could not load refs. Check your connection and retry."); }
  }
}

export function useRefs() {
  const [refs, setRefs] = useState<ScriptureRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const gen = ++genRef.current;
    fetchRefs(gen, genRef, setRefs, setLoading, setError);
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    void fetchRefs(gen, genRef, setRefs, setLoading, setError);
    const generation = genRef;
    return () => { generation.current++; };
  }, []);

  const addRef = useCallback(async (payload: Omit<ScriptureRef, "id" | "createdAt">) => {
    const res = await fetch("/api/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Could not save your change. Please retry.");
    if (res.ok) {
      const created: ScriptureRef = await res.json();
      setRefs(prev => [...prev, created]);
      notifyDataChanged();
      return created;
    }
  }, []);

  const deleteRef = useCallback(async (id: string) => {
    const res = await fetch(`/api/refs/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not save your change. Please retry.");
    if (res.ok) setRefs(prev => prev.filter(r => r.id !== id));
    notifyDataChanged();
  }, []);

  return { refs, loading, error, reload: load, addRef, deleteRef };
}
