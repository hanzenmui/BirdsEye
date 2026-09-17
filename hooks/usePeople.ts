"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person } from "@/lib/types";

async function fetchPeople(
  gen: number,
  genRef: { current: number },
  setPeople: (p: Person[]) => void,
  setLoading: (l: boolean) => void,
  setError: (message: string | null) => void,
) {
  try {
    const res = await fetch("/api/people");
    if (!res.ok) {
      if (res.status === 401) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      console.error("Failed to load people:", res.status);
      if (gen === genRef.current) { setLoading(false); setError("Could not load people. Check your connection and retry."); }
      return;
    }
    const data = await res.json();
    if (gen === genRef.current) { setPeople(data); setLoading(false); }
  } catch (e) {
    console.error("Failed to load people:", e);
    if (gen === genRef.current) { setLoading(false); setError("Could not load people. Check your connection and retry."); }
  }
}

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const gen = ++genRef.current;
    fetchPeople(gen, genRef, setPeople, setLoading, setError);
  }, []);

  useEffect(() => {
    const gen = ++genRef.current;
    void fetchPeople(gen, genRef, setPeople, setLoading, setError);
    const generation = genRef;
    return () => { generation.current++; };
  }, []);

  const addPerson = useCallback(async (payload: Omit<Person, "id" | "createdAt">) => {
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const created: Person = await res.json();
    setPeople(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    notifyDataChanged();
    return created;
  }, []);

  const updatePerson = useCallback(async (id: string, patch: Partial<Person>) => {
    const res = await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await res.text());
    const updated: Person = await res.json();
    setPeople(prev => prev.map(p => p.id === id ? updated : p));
    notifyDataChanged();
    return updated;
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not save your change. Please retry.");
    if (res.ok) setPeople(prev => prev.filter(p => p.id !== id));
    notifyDataChanged();
  }, []);

  return { people, loading, error, reload: load, addPerson, updatePerson, deletePerson };
}
