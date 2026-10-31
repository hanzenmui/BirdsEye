// Presentation and controlled reads only: no credentials, requests, or DB.
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryContent } from "../components/InterfaceState";
import { LoadError } from "../components/LoadError";
import { loadLibraryCollection } from "../lib/library-collection";

const view = (ready: boolean, loading: boolean, empty = false) => renderToStaticMarkup(
  <LibraryContent ready={ready} loading={loading} label="Opening records…">
    <section>{empty ? "No records yet" : "Already loaded records"}<input aria-label="Search records" /></section>
  </LibraryContent>,
);

async function main() {
  assert.match(view(false, true), /Opening records/);
  assert.doesNotMatch(view(false, true), /Search records|No records yet/);
  assert.equal(view(false, false), "", "An initial failure must not look like an empty collection");
  for (const loading of [true, false]) {
    assert.match(view(true, loading), /Already loaded records/);
    assert.match(view(true, loading), /Search records/);
    assert.doesNotMatch(view(true, loading), /Opening records/);
    assert.match(view(true, loading, true), /No records yet/, "A successfully loaded empty collection is ready too");
  }
  const warning = renderToStaticMarkup(<LoadError message="Could not refresh people." onRetry={() => {}} retainedContent />);
  assert.match(warning, /Couldn’t refresh this view/);
  assert.match(warning, /loaded records are still available/);
  assert.match(warning, /role="alert"/);
  assert.match(warning, /Try again/);
  const initialError = renderToStaticMarkup(<LoadError message="Could not load people." onRetry={() => {}} />);
  assert.match(initialError, /This view didn’t load/);
  assert.doesNotMatch(initialError, /records are still available/);

  const original = globalThis.fetch;
  let ready = false;
  let items: string[] = [];
  let error: string | null = null;
  const version = { current: 0 };
  const read = () => loadLibraryCollection<string>({
    url: "/test-only", version,
    onLoaded: loaded => { items = loaded; ready = true; },
    onError: message => { error = message; }, onSettled: () => {},
    errorMessage: "Could not refresh.",
  });
  try {
    globalThis.fetch = async () => { throw new Error("Test failure"); };
    await read();
    assert.equal(ready, false, "Initial failures cannot establish a readable snapshot");
    assert.equal(view(ready, false), "");
    globalThis.fetch = async () => Response.json([]);
    await read();
    assert.equal(ready, true, "An empty successful reply establishes readiness");
    assert.equal(error, null);
    globalThis.fetch = async () => Response.json(["Saved person"]);
    await read();
    globalThis.fetch = async () => { throw new Error("Test refresh failure"); };
    await read();
    assert.equal(ready, true);
    assert.deepEqual(items, ["Saved person"]);
    assert.notEqual(error, null);
    assert.match(view(ready, false), /Search records/);
  } finally { globalThis.fetch = original; }
  console.log("Library view checks passed: initial loading/failure, retained content during retries/failures, empty successful loads, safe refresh warning, and recovery readiness.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
