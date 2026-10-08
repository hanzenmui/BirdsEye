"use client";
import { useCallback, useEffect, useState } from "react";

async function readOwnerSession() {
  const response = await fetch("/api/owner/session", { cache: "no-store" });
  if (!response.ok) throw new Error();
  return response.json();
}

export function useOwner() {
  const [owner, setOwner] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const session = await readOwnerSession();
      setOwner(session.owner === true); setConfigured(session.configured === true); setError("");
    } catch { setOwner(false); setError("Could not check owner access. Check your connection and retry."); }
  }, []);
  useEffect(() => {
    let active = true;
    readOwnerSession().then(session => {
      if (active) { setOwner(session.owner === true); setConfigured(session.configured === true); setError(""); }
    }).catch(() => { if (active) { setOwner(false); setError("Could not check owner access. Check your connection and retry."); } });
    window.addEventListener("focus", reload);
    window.addEventListener("birdseye-owner-expired", reload);
    const timer = window.setInterval(reload, 60000);
    return () => {
      active = false;
      window.removeEventListener("focus", reload);
      window.removeEventListener("birdseye-owner-expired", reload);
      window.clearInterval(timer);
    };
  }, [reload]);
  return { owner, configured, error, reload };
}
