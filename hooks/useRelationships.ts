"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { libraryRequest } from "@/lib/library-request";
import { loadLibraryCollection } from "@/lib/library-collection";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Relationship } from "@/lib/types";

export function useRelationships() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const refresh = useCallback(() => loadLibraryCollection<Relationship>({
    url: "/api/relationships", version: genRef,
    onLoaded: items => { setRelationships(items); setHasLoaded(true); },
    onError: setError, onSettled: () => setLoading(false),
    errorMessage: "Could not load relationships. Check your connection and retry.",
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

  const addRelationship = useCallback(async (payload: Omit<Relationship, "id" | "createdAt">) => {
    const res = await libraryRequest("/api/relationships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created: Relationship = await res.json();
    setRelationships(prev => [created, ...prev]);
    void refresh();
    notifyDataChanged();
    return created;
  }, [refresh]);

  const deleteRelationship = useCallback(async (id: string) => {
    await libraryRequest(`/api/relationships/${id}`, { method: "DELETE" });
    setRelationships(prev => prev.filter(r => r.id !== id));
    void refresh();
    notifyDataChanged();
  }, [refresh]);

  return { relationships, loading, hasLoaded, error, reload: load, addRelationship, deleteRelationship };
}
