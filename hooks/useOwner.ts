"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadLatestOwnerStatus } from "@/lib/owner-status";

export function useOwner() {
  const [owner, setOwner] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const reload = useCallback(() => loadLatestOwnerStatus(requestVersion,
    session => {
      setOwner(session.owner === true); setConfigured(session.configured === true); setError("");
    },
    () => { setOwner(false); setError("Could not check owner access. Check your connection and retry."); },
  ), []);
  useEffect(() => {
    void reload();
    window.addEventListener("focus", reload);
    window.addEventListener("birdseye-owner-expired", reload);
    const timer = window.setInterval(reload, 60000);
    const version = requestVersion;
    return () => {
      // Ignore every outstanding response after cleanup, including focus and
      // polling requests. Also handles Strict Mode's cleanup/remount cycle.
      version.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("birdseye-owner-expired", reload);
      window.clearInterval(timer);
    };
  }, [reload]);
  return { owner, configured, error, reload };
}
