"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Relationship } from "@/lib/types";

async function fetchRelationships(
  gen: number,
  genRef: { current: number },
  setRelationships: (r: Relationship[]) => void,
  setLoading: (l: boolean) => void,
  setError: (message: string | null) => void,
) {
  try {
    const res = await fetch("/api/relationships");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      console.error("Failed to load relationships:", res.status);
      if (gen === genRef.current) { setLoading(false); setError("Could not load relationships. Check your connection and retry."); }
      return;
    }
    const data = await res.json();
    if (gen === genRef.current) { setRelationships(data); setLoading(false); }
  } catch (e) {
    console.error("Failed to load relationships:", e);
    if (gen === genRef.current) { setLoading(false); setError("Could not load relationships. Check your connection and retry."); }
  }
}

export function useRelationships() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const gen = ++genRef.current;
    fetchRelationships(gen, genRef, setRelationships, setLoading, setError);
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    void fetchRelationships(gen, genRef, setRelationships, setLoading, setError);
    const generation = genRef;
    return () => { generation.current++; };
  }, []);

  const addRelationship = useCallback(async (payload: Omit<Relationship, "id" | "createdAt">) => {
    const res = await fetch("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Could not save your change. Please retry.");
    if (res.ok) {
      const created: Relationship = await res.json();
      setRelationships(prev => [created, ...prev]);
      notifyDataChanged();
      return created;
    }
  }, []);

  const deleteRelationship = useCallback(async (id: string) => {
    const res = await fetch(`/api/relationships/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not save your change. Please retry.");
    if (res.ok) setRelationships(prev => prev.filter(r => r.id !== id));
    notifyDataChanged();
  }, []);

  return { relationships, loading, error, reload: load, addRelationship, deleteRelationship };
}
