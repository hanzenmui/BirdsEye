type RequestVersion = { current: number };
type OwnerStatus = { owner: boolean; configured: boolean };

// Initial load, focus, polling, and explicit sign-in/out refreshes share one
// version. Only the newest request may update UI, including on failures.
// This is display state only; API routes still authorize every library write.
export async function loadLatestOwnerStatus(
  version: RequestVersion,
  onSession: (session: OwnerStatus) => void,
  onError: () => void,
) {
  const request = ++version.current;
  try {
    const response = await fetch("/api/owner/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Owner status unavailable");
    const session: unknown = await response.json();
    if (!session || typeof session !== "object" || !("owner" in session) || !("configured" in session)
      || typeof session.owner !== "boolean" || typeof session.configured !== "boolean") {
      throw new Error("Invalid owner status");
    }
    if (request === version.current) onSession({ owner: session.owner, configured: session.configured });
  } catch {
    if (request === version.current) onError();
  }
}
