// No real network, environment files, or database: client error contract only.
import assert from "node:assert/strict";
import { libraryRequest, LibraryRequestError, libraryErrorMessage } from "../lib/library-request";
import { validatePersonFields } from "../lib/mappers";

async function main() {
  assert.equal(validatePersonFields({ name: "x".repeat(501) }), "Keep the name to 500 characters or fewer.");
  assert.equal(validatePersonFields({ description: "x".repeat(20001) }), "Keep the description to 20,000 characters or fewer.");
  assert.equal(validatePersonFields({ name: "x".repeat(500), description: "x".repeat(20000) }), null, "Validation limits have not changed");
  const original = globalThis.fetch;
  let calls = 0;
  const expected = "This relationship already exists between these two people.";
  try {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      globalThis.fetch = async () => Response.json({ error: expected }, { status });
      await assert.rejects(libraryRequest("/api/relationships", { method: "POST" }), error =>
        error instanceof LibraryRequestError && error.message === expected);
    }
    for (const body of [null, {}, { error: 42 }, { error: "  " }, { error: "x".repeat(501) }]) {
      globalThis.fetch = async () => Response.json(body, { status: 400 });
      await assert.rejects(libraryRequest("/api/refs", { method: "POST" }), /Could not complete this change/);
    }
    for (const status of [400, 500, 502]) {
      globalThis.fetch = async () => new Response("<html>Private proxy diagnostics</html>", { status });
      await assert.rejects(libraryRequest("/api/people", { method: "PATCH" }), /Could not complete this change/);
    }
    globalThis.fetch = async () => Response.json({ error: "Private database diagnostics" }, { status: 500 });
    await assert.rejects(libraryRequest("/api/people", { method: "PATCH" }), /Could not complete this change/);
    globalThis.fetch = async () => { calls++; throw new TypeError("Failed to fetch"); };
    await assert.rejects(libraryRequest("/api/refs", { method: "POST" }), /Check your connection and the record/);
    assert.equal(calls, 1, "Writes must never be automatically retried");
    const success = Response.json({ id: "saved" }, { status: 201 });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "/api/people"); assert.equal(options?.body, '{"name":"Example"}');
      return success;
    };
    assert.equal(await libraryRequest("/api/people", { method: "POST", body: '{"name":"Example"}' }), success);
    assert.deepEqual(await success.json(), { id: "saved" }, "Successful bodies stay readable by hooks");
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal((await libraryRequest("/api/people/x", { method: "DELETE" })).status, 204);
    assert.equal(libraryErrorMessage(new Error("Private exception"), "Safe fallback"), "Safe fallback");
    assert.equal(libraryErrorMessage(new LibraryRequestError(expected), "Fallback"), expected);
    console.log("Library request checks passed: actionable errors, safe malformed/server responses, uncertain network results, no automatic write retries, successful saves/deletes.");
  } finally { globalThis.fetch = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
