"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { libraryRequest } from "@/lib/library-request";
import { loadLibraryCollection } from "@/lib/library-collection";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Person } from "@/lib/types";

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const refresh = useCallback(() => loadLibraryCollection<Person>({
    url: "/api/people", version: genRef,
    onLoaded: items => { setPeople(items); setHasLoaded(true); },
    onError: setError, onSettled: () => setLoading(false),
    errorMessage: "Could not load people. Check your connection and retry.",
  }), []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const generation = genRef;
    return () => { generation.current++; };
  }, [refresh]);

  const addPerson = useCallback(async (payload: Omit<Person, "id" | "createdAt">) => {
    const res = await libraryRequest("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created: Person = await res.json();
    setPeople(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    void refresh();
    notifyDataChanged();
    return created;
  }, [refresh]);

  const updatePerson = useCallback(async (id: string, patch: Partial<Person>) => {
    const res = await libraryRequest(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated: Person = await res.json();
    setPeople(prev => prev.map(p => p.id === id ? updated : p));
    void refresh();
    notifyDataChanged();
    return updated;
  }, [refresh]);

  const deletePerson = useCallback(async (id: string) => {
    await libraryRequest(`/api/people/${id}`, { method: "DELETE" });
    setPeople(prev => prev.filter(p => p.id !== id));
    void refresh();
    notifyDataChanged();
  }, [refresh]);

  return { people, loading, hasLoaded, error, reload: load, addPerson, updatePerson, deletePerson };
}
