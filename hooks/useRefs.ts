"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ScriptureRef } from "@/lib/types";

export function useRefs() {
  const [refs, setRefs] = useState<ScriptureRef[]>([]);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    const res = await fetch("/api/refs");
    if (!res.ok) { if (res.status === 401) window.location.href = "/login"; return; }
    const data = await res.json();
    if (gen === genRef.current) { setRefs(data); setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRef = useCallback(async (payload: Omit<ScriptureRef, "id" | "createdAt">) => {
    const res = await fetch("/api/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created: ScriptureRef = await res.json();
      setRefs(prev => [...prev, created]);
      return created;
    }
  }, []);

  const deleteRef = useCallback(async (id: string) => {
    const res = await fetch(`/api/refs/${id}`, { method: "DELETE" });
    if (res.ok) setRefs(prev => prev.filter(r => r.id !== id));
  }, []);

  return { refs, loading, reload: load, addRef, deleteRef };
}
