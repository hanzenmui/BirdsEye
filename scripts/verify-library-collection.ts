// Controlled response ordering only: no credentials, real requests, or DB.
import assert from "node:assert/strict";
import { loadLibraryCollection } from "../lib/library-collection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function checkCollection(url: string) {
  type Record = { id: string; label: string };
  const original = globalThis.fetch;
  const version = { current: 0 };
  const pending: ReturnType<typeof deferred<Response>>[] = [];
  let items: Record[] = [{ id: "existing", label: "Before edit" }];
  let error: string | null = null;
  let settled = 0;
  globalThis.fetch = async (path, options) => {
    assert.equal(path, url);
    assert.equal(options?.cache, "no-store");
    const request = deferred<Response>(); pending.push(request);
    return request.promise;
  };
  const begin = () => {
    const done = loadLibraryCollection<Record>({
      url, version,
      onLoaded: loaded => { items = loaded; },
      onError: message => { error = message; },
      onSettled: () => { settled++; },
      errorMessage: "Could not refresh this collection.",
    });
    return { done, request: pending[pending.length - 1] };
  };
  const respond = (rows: Record[]) => Response.json(rows);
  try {
    // A confirmed local addition must survive a pre-save read arriving first.
    let old = begin();
    const added = { id: "added", label: "Saved addition" };
    items = [...items, added];
    let fresh = begin();
    old.request.resolve(respond([{ id: "existing", label: "Before edit" }]));
    await old.done;
    assert.ok(items.some(row => row.id === added.id), "An old read cannot hide a saved addition");
    assert.equal(settled, 0, "An old read cannot dismiss the newest loading state");
    fresh.request.resolve(respond(items)); await fresh.done;

    // A completed fresh read can include restored records missing locally.
    old = begin();
    items = items.map(row => row.id === "existing" ? { ...row, label: "Saved edit" } : row);
    fresh = begin();
    const restored = { id: "restored", label: "Restored in another action" };
    fresh.request.resolve(respond([...items, restored])); await fresh.done;
    old.request.resolve(respond([{ id: "existing", label: "Before edit" }])); await old.done;
    assert.equal(items.find(row => row.id === "existing")?.label, "Saved edit");
    assert.ok(items.some(row => row.id === restored.id), "The fresh read reconciles the complete collection");

    old = begin(); items = items.filter(row => row.id !== added.id); fresh = begin();
    fresh.request.resolve(respond(items)); await fresh.done;
    old.request.resolve(respond([added])); await old.done;
    assert.ok(!items.some(row => row.id === added.id), "An old read cannot resurrect a removed record");

    old = begin(); fresh = begin();
    fresh.request.resolve(respond(items)); await fresh.done;
    old.request.reject(new Error("Stale connection failure")); await old.done;
    assert.equal(error, null, "A stale error cannot replace a successful refresh");

    const saved = items;
    old = begin(); fresh = begin();
    fresh.request.reject(new Error("Current connection failure")); await fresh.done;
    old.request.resolve(respond([])); await old.done;
    assert.equal(items, saved, "Failed reconciliation retains confirmed local changes");
    assert.equal(error, "Could not refresh this collection.");
    fresh = begin(); fresh.request.resolve(respond(saved)); await fresh.done;
    assert.equal(error, null, "A successful retry clears the load error");

    for (const response of [new Response("private diagnostics", { status: 500 }), new Response("not JSON")]) {
      fresh = begin(); fresh.request.resolve(response); await fresh.done;
      assert.deepEqual(items, saved);
      assert.equal(error, "Could not refresh this collection.", "Current failures use safe feedback");
    }

    // The version check must happen after body parsing, not just HTTP arrival.
    const body = deferred<Record[]>(); old = begin();
    old.request.resolve({ ok: true, json: () => body.promise } as Response);
    await Promise.resolve();
    fresh = begin(); fresh.request.resolve(respond(saved)); await fresh.done;
    body.resolve([]); await old.done;
    assert.deepEqual(items, saved, "A slowly parsed older body is ignored too");

    old = begin(); fresh = begin(); const before = settled;
    version.current++; // Hook cleanup invalidates all outstanding reads.
    old.request.resolve(respond([])); fresh.request.reject(new Error("Unmounted"));
    await Promise.all([old.done, fresh.done]);
    assert.deepEqual(items, saved);
    assert.equal(error, null);
    assert.equal(settled, before, "Unmounted responses cannot update loading state");
    fresh = begin(); fresh.request.resolve(respond(saved)); await fresh.done;
    assert.equal(settled, before + 1, "Remount can load normally");
    console.log(`${url}: saved additions/edits/removals, full reconciliation, stale replies/errors, current failure/retry, slow JSON, and cleanup passed.`);
  } finally { globalThis.fetch = original; }
}

async function main() {
  for (const url of ["/api/people", "/api/refs", "/api/relationships"]) await checkCollection(url);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
