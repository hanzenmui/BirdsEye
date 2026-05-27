"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Relationship } from "@/lib/types";

export function useRelationships() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    try {
      const res = await fetch("/api/relationships");
      if (!res.ok) {
        if (res.status === 401) { window.location.href = "/login"; return; }
        console.error("Failed to load relationships:", res.status);
        if (gen === genRef.current) setLoading(false);
        return;
      }
      const data = await res.json();
      if (gen === genRef.current) { setRelationships(data); setLoading(false); }
    } catch (e) {
      console.error("Failed to load relationships:", e);
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRelationship = useCallback(async (payload: Omit<Relationship, "id" | "createdAt">) => {
    const res = await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created: Relationship = await res.json();
      setRelationships(prev => [created, ...prev]);
      return created;
    }
  }, []);

  const deleteRelationship = useCallback(async (id: string) => {
    const res = await fetch(`/api/relationships/${id}`, { method: "DELETE" });
    if (res.ok) setRelationships(prev => prev.filter(r => r.id !== id));
  }, []);

  return { relationships, loading, reload: load, addRelationship, deleteRelationship };
}
