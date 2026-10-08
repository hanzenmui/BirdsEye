"use client";
import { useCallback, useEffect, useState } from "react";

type DeletedRecord = { id: string; label: string; kind: string; deletedAt: string };
type Props = { owner: boolean; configured: boolean; sessionError: string; onSessionChange: () => Promise<void>; onRestored: () => void };

async function checkedFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("birdseye-owner-expired"));
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Could not complete this action. Check your connection and retry.");
  }
  return response;
}

export function OwnerTools({ owner, configured, sessionError, onSessionChange, onRestored }: Props) {
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRecords = useCallback(async () => {
    try { const data = await (await checkedFetch("/api/owner/recovery")).json(); setRecords(data); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not open recently deleted records."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    checkedFetch("/api/owner/recovery").then(response => response.json())
      .then(data => { if (active) setRecords(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not open recently deleted records."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner]);
  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setError(""); setNotice("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not complete this action. Please retry."); }
    finally { setBusy(null); }
  };
  return <div className="modal-body owner-tools">
    {(error || sessionError) && <p className="owner-error" role="alert">{error || sessionError}</p>}
    {notice && <p className="owner-notice" role="status">{notice}</p>}
    {!owner ? <form onSubmit={event => {
      event.preventDefault();
      void run("sign-in", async () => {
        await checkedFetch("/api/owner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
        setPasscode(""); await onSessionChange();
      });
    }}>
      {!configured && <p className="owner-error">Owner access needs ADMIN_PASSCODE (8+ characters) and AUTH_SECRET (32+ characters) in hosting settings. Readers can still use the app.</p>}
      <label className="form-label" htmlFor="owner-passcode">Owner passcode</label>
      <input className="form-input" id="owner-passcode" name="password" type="password" autoComplete="current-password" value={passcode} onChange={e => setPasscode(e.target.value)} required maxLength={1024} disabled={!!busy} />
      <p className="owner-help">Only the owner can add, edit, or remove records. You stay signed in for up to 8 hours.</p>
      <button type="submit" className="btn btn-primary" disabled={!!busy || !configured}>{busy === "sign-in" ? "Signing in…" : "Sign in to edit"}</button>
    </form> : <>
      <div className="owner-session-row"><span><i aria-hidden="true" />Owner editing is on</span><button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void run("sign-out", async () => {
        await checkedFetch("/api/owner/session", { method: "DELETE" }); await onSessionChange();
      })}>{busy === "sign-out" ? "Signing out…" : "Sign out"}</button></div>
      <section className="owner-backup" aria-labelledby="backup-title">
        <h3 id="backup-title">Keep a backup</h3>
        <p>Download the complete library, including timeline, traditions, and recently deleted records. Save a copy somewhere safe before making big changes.</p>
        <button className="btn btn-primary" disabled={!!busy} onClick={() => void run("backup", async () => {
          const response = await checkedFetch("/api/owner/backup");
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a"); link.href = url;
          link.download = `birdseye-backup-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link); link.click(); link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 60000);
          setNotice("Backup download started. Keep the file somewhere safe.");
        })}>{busy === "backup" ? "Preparing backup…" : "Download library backup"}</button>
      </section>
      <section aria-labelledby="recovery-title" className="owner-recovery">
        <div className="owner-recovery-heading"><h3 id="recovery-title">Recently deleted</h3><button className="btn btn-ghost btn-sm" disabled={!!busy || loading} onClick={() => { setLoading(true); setError(""); void loadRecords(); }}>Refresh</button></div>
        <p>Restore a person with their references and connections, or restore a single removed reference or relationship. Nothing is overwritten.</p>
        {loading ? <p role="status">Opening recovery records…</p> : records.length === 0 ? <p className="owner-empty">No deleted records to recover.</p> : <ul>
          {records.map(record => <li key={record.id}>
            <div><strong>{record.label}</strong><span>{record.kind} · {new Date(record.deletedAt).toLocaleDateString()}</span></div>
            <button className="btn btn-ghost btn-sm" disabled={!!busy} aria-label={`Restore ${record.label}`} onClick={() => void run(record.id, async () => {
              await checkedFetch(`/api/owner/recovery/${encodeURIComponent(record.id)}`, { method: "POST" });
              setRecords(prev => prev.filter(r => r.id !== record.id)); onRestored(); setNotice(`${record.label} restored.`);
            })}>{busy === record.id ? "Restoring…" : "Restore"}</button>
          </li>)}
        </ul>}
        <p className="owner-help">Recovery starts with deletions made after this update. It is not a separate off-site backup.</p>
      </section>
    </>}
  </div>;
}
