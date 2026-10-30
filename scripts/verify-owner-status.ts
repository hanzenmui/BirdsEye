// Deterministic race checks: no environment, credentials, real HTTP, or DB.
import assert from "node:assert/strict";
import { loadLatestOwnerStatus } from "../lib/owner-status";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function main() {
  const original = globalThis.fetch;
  const version = { current: 0 };
  let state = { owner: false, configured: true, error: "" };
  let updates = 0;
  const pending: ReturnType<typeof deferred<Response>>[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/owner/session");
    assert.equal(options?.cache, "no-store");
    const request = deferred<Response>(); pending.push(request);
    return request.promise;
  };
  const begin = () => {
    const done = loadLatestOwnerStatus(version,
      session => { state = { ...session, error: "" }; updates++; },
      () => { state = { ...state, owner: false, error: "Could not check owner access" }; updates++; },
    );
    return { done, request: pending[pending.length - 1] };
  };
  const response = (owner: boolean, configured = true) => Response.json({ owner, configured });
  try {
    let old = begin(); let latest = begin();
    latest.request.resolve(response(true)); await latest.done;
    old.request.resolve(response(false)); await old.done;
    assert.equal(state.owner, true, "An older signed-out result cannot undo sign-in");
    assert.equal(updates, 1);

    old = begin(); latest = begin();
    latest.request.resolve(response(false)); await latest.done;
    old.request.resolve(response(true)); await old.done;
    assert.equal(state.owner, false, "An older owner result cannot undo sign-out");

    old = begin(); latest = begin();
    latest.request.resolve(response(true)); await latest.done;
    old.request.reject(new Error("Old request lost its connection")); await old.done;
    assert.equal(state.owner, true, "Stale failures cannot hide editing after a newer success");
    assert.equal(state.error, "");

    old = begin(); latest = begin();
    latest.request.reject(new Error("Latest request lost its connection")); await latest.done;
    old.request.resolve(response(true)); await old.done;
    assert.equal(state.owner, false, "Current failures still disable editing");
    assert.notEqual(state.error, "");

    for (const data of [null, {}, { owner: "true", configured: true }, { owner: true, configured: "true" }]) {
      latest = begin(); latest.request.resolve(Response.json(data)); await latest.done;
      assert.equal(state.owner, false, "Malformed responses fail closed");
      assert.notEqual(state.error, "");
    }
    latest = begin(); latest.request.resolve(new Response("unavailable", { status: 503 })); await latest.done;
    assert.equal(state.owner, false);
    latest = begin(); latest.request.resolve(new Response("not JSON")); await latest.done;
    assert.equal(state.owner, false);

    old = begin(); const before = updates;
    version.current++; // The hook invalidates all pending work on cleanup.
    old.request.resolve(response(true)); await old.done;
    assert.equal(updates, before, "Unmounted requests cannot update state");
    old = begin(); version.current++; latest = begin();
    latest.request.resolve(response(true, false)); await latest.done;
    old.request.resolve(response(false)); await old.done;
    assert.deepEqual(state, { owner: true, configured: false, error: "" }, "Cleanup/remount uses the new request for every field");

    old = begin(); latest = begin(); const waiting = updates;
    old.request.resolve(response(false)); await old.done;
    assert.equal(updates, waiting, "Older results are ignored even while the newest request is pending");
    latest.request.resolve(response(false, true)); await latest.done;
    assert.deepEqual(state, { owner: false, configured: true, error: "" }, "A current signed-out result still removes editing");
    console.log("Owner status checks passed: out-of-order sign-in/out, stale failures, current failures, invalid responses, cleanup/remount, and uncached requests.");
  } finally { globalThis.fetch = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
