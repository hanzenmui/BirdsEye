"use client";
import { notifyDataChanged } from "@/lib/data-events";
import { libraryRequest } from "@/lib/library-request";
import { loadLibraryCollection } from "@/lib/library-collection";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ScriptureRef } from "@/lib/types";

export function useRefs() {
  const [refs, setRefs] = useState<ScriptureRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const refresh = useCallback(() => loadLibraryCollection<ScriptureRef>({
    url: "/api/refs", version: genRef,
    onLoaded: items => { setRefs(items); setHasLoaded(true); },
    onError: setError, onSettled: () => setLoading(false),
    errorMessage: "Could not load refs. Check your connection and retry.",
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

  const addRef = useCallback(async (payload: Omit<ScriptureRef, "id" | "createdAt">) => {
    const res = await libraryRequest("/api/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created: ScriptureRef = await res.json();
    setRefs(prev => [...prev, created]);
    void refresh();
    notifyDataChanged();
    return created;
  }, [refresh]);

  const deleteRef = useCallback(async (id: string) => {
    await libraryRequest(`/api/refs/${id}`, { method: "DELETE" });
    setRefs(prev => prev.filter(r => r.id !== id));
    void refresh();
    notifyDataChanged();
  }, [refresh]);

  return { refs, loading, hasLoaded, error, reload: load, addRef, deleteRef };
}
