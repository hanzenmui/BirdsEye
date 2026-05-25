"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person } from "@/lib/types";

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    const res = await fetch("/api/people");
    if (!res.ok) { if (res.status === 401) window.location.href = "/login"; return; }
    const data = await res.json();
    if (gen === genRef.current) { setPeople(data); setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPerson = useCallback(async (payload: Omit<Person, "id" | "createdAt">) => {
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created: Person = await res.json();
      setPeople(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    }
  }, []);

  const updatePerson = useCallback(async (id: string, patch: Partial<Person>) => {
    const res = await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: Person = await res.json();
      setPeople(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    }
  }, []);

  const deletePerson = useCallback(async (id: string) => {
    const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
    if (res.ok) setPeople(prev => prev.filter(p => p.id !== id));
  }, []);

  return { people, loading, reload: load, addPerson, updatePerson, deletePerson };
}
