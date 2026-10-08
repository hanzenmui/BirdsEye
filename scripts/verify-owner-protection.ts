// Isolated integration checks. Never load .env.local or use the live database.
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { getReadyDb } from "../lib/db";
import { createOwnerToken, ownerConfigured, validOwnerToken, OWNER_COOKIE } from "../lib/owner-session";
import { archiveRecord, restoreRecord, exportLibrary } from "../lib/recovery";
import { GET as readPeople, POST as addPerson } from "../app/api/people/route";
import { PATCH as editPerson, DELETE as deletePerson } from "../app/api/people/[id]/route";
import { POST as addRef } from "../app/api/refs/route";
import { DELETE as deleteRef } from "../app/api/refs/[id]/route";
import { POST as addRel } from "../app/api/relationships/route";
import { DELETE as deleteRel } from "../app/api/relationships/[id]/route";
import { POST as login, GET as session, DELETE as logout } from "../app/api/owner/session/route";
import { GET as readRecovery } from "../app/api/owner/recovery/route";
import { POST as restore } from "../app/api/owner/recovery/[id]/route";
import { GET as backup } from "../app/api/owner/backup/route";
import { GET as study } from "../app/api/study/route";

async function main() {
  const scratch = await mkdtemp(join(tmpdir(), "birdseye-owner-check-"));
  const path = join(scratch, "test.db");
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = process.argv.includes("--libsql") ? `file:${path.replaceAll("\\", "/")}` : "";
  process.env.DB_MODE = process.argv.includes("--libsql") ? "turso" : "local";
  process.env.SQLITE_PATH = path;
  process.env.ADMIN_PASSCODE = "test-only-owner-passcode";
  process.env.AUTH_SECRET = "test-only-secret-not-used-by-any-deployment-123456789";
  const db = await getReadyDb();
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (path: string, method = "GET", body?: unknown, token?: string, origin = "http://localhost") => new NextRequest(`http://localhost${path}`, {
    method, headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Cookie: `${OWNER_COOKIE}=${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await readPeople()).status, 200, "Reading stays public");
  for (const response of await Promise.all([
    addPerson(req("/api/people", "POST", {})), editPerson(req("/api/people/x", "PATCH", {}), ctx("x")),
    deletePerson(req("/api/people/x", "DELETE"), ctx("x")), addRef(req("/api/refs", "POST", {})),
    deleteRef(req("/api/refs/x", "DELETE"), ctx("x")), addRel(req("/api/relationships", "POST", {})),
    deleteRel(req("/api/relationships/x", "DELETE"), ctx("x")), readRecovery(req("/api/owner/recovery")),
    backup(req("/api/owner/backup")), restore(req("/api/owner/recovery/x", "POST"), ctx("x")),
  ])) assert.equal(response.status, 401, "Every editing and recovery endpoint requires owner access");
  assert.equal((await login(req("/api/owner/session", "POST", { passcode: process.env.ADMIN_PASSCODE }, undefined, "https://other.test"))).status, 403);
  assert.equal((await login(req("/api/owner/session", "POST", { passcode: "wrong" }))).status, 401);
  assert.equal((await login(req("/api/owner/session", "POST", { passcode: "x".repeat(5000) }))).status, 413, "Public sign-in requests have a size bound");
  assert.equal((await login(req("/api/owner/session", "POST", null))).status, 400);
  const signedIn = await login(req("/api/owner/session", "POST", { passcode: process.env.ADMIN_PASSCODE }));
  assert.equal(signedIn.status, 200);
  const token = signedIn.cookies.get(OWNER_COOKIE)!.value;
  assert.equal(signedIn.cookies.get(OWNER_COOKIE)!.httpOnly, true);
  assert.equal(signedIn.cookies.get(OWNER_COOKIE)!.sameSite, "strict");
  assert.equal(await validOwnerToken(token), true);
  assert.equal(await validOwnerToken(`${token}changed`), false);
  assert.equal(await validOwnerToken(await createOwnerToken(Date.now() - 9 * 3600000)), false, "Expiry is enforced without the library's clock tolerance");
  assert.equal((await session(req("/api/owner/session", "GET", undefined, token))).status, 200);
  assert.equal((await addPerson(req("/api/people", "POST", {}, token, "https://other.test"))).status, 403);
  const oldPasscode = process.env.ADMIN_PASSCODE;
  process.env.ADMIN_PASSCODE = "rotated-test-only-passcode";
  assert.equal(await validOwnerToken(token), false, "Credential rotation revokes sessions");
  process.env.ADMIN_PASSCODE = oldPasscode;
  const oldSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "";
  assert.equal(ownerConfigured(), false);
  assert.equal(await validOwnerToken(token), false);
  assert.equal((await login(req("/api/owner/session", "POST", { passcode: oldPasscode }))).status, 503);
  process.env.AUTH_SECRET = oldSecret;
  await db.run("UPDATE owner_login_attempts SET attempts=10 WHERE id='owner'");
  const throttled = await login(req("/api/owner/session", "POST", { passcode: oldPasscode }));
  assert.equal(throttled.status, 429);
  assert.ok(Number(throttled.headers.get("Retry-After")) > 0);

  const personBody = (name: string) => ({ name, gender: "male", testament: "OT", description: "Test fixture", tags: [] });
  const father = await (await addPerson(req("/api/people", "POST", personBody("Father"), token))).json();
  const child = await (await addPerson(req("/api/people", "POST", personBody("Child"), token))).json();
  assert.equal((await addPerson(req("/api/people", "POST", { name: "" }, token))).status, 400);
  assert.equal((await addRel(req("/api/relationships", "POST", null, token))).status, 400);
  assert.equal((await addRef(req("/api/refs", "POST", null, token))).status, 400);
  const rel = await (await addRel(req("/api/relationships", "POST", { personAId: father.id, personBId: child.id, personAName: "spoof", personBName: "spoof", type: "parent_of", notes: "A test link" }, token))).json();
  assert.equal(rel.personAName, "Father", "Names come from the library, not the request");
  await db.run("DROP INDEX IF EXISTS idx_relationships_unique");
  assert.equal((await addRel(req("/api/relationships", "POST", { ...rel }, token))).status, 409, "Legacy libraries without a uniqueness index still reject new duplicates");
  await db.run("CREATE UNIQUE INDEX idx_relationships_unique ON relationships(person_a_id,type,person_b_id)");
  const ref = await (await addRef(req("/api/refs", "POST", { personId: child.id, book: "Genesis", chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 3, note: "Test passage" }, token))).json();
  assert.equal((await addRef(req("/api/refs", "POST", { ...ref, chapterEnd: 0 }, token))).status, 400);
  await db.run("UPDATE people SET timeline_start_bc=1000,timeline_end_bc=900,timeline_track='judge',date_uncertainty_note='Test uncertainty' WHERE id=$1", [child.id]);
  await db.run("INSERT INTO historical_events (id,title,year_bc,created_at) VALUES ('test-event','Test event',950,'now')");
  await db.run("INSERT INTO scripture_refs (id,person_id,event_id,book,chapter_start,chapter_end,verse_start,verse_end,created_at) VALUES ('event-ref','','test-event','Genesis',1,2,1,1,'now')");
  await db.run("INSERT INTO prophecy_links (id,prophet_person_id,prophecy_book,prophecy_chapter_start,prophecy_chapter_end,prophecy_verse_start,prophecy_verse_end,fulfillment_event_id,created_at) VALUES ('test-prophecy',$1,'Genesis',1,1,1,3,'test-event','now')", [child.id]);
  await db.run("INSERT INTO traditions (id,name,start_year,created_at) VALUES ('test-tradition','Test tradition',-100,'now')");
  await db.run("INSERT INTO tradition_people (id,tradition_id,person_id,created_at) VALUES ('test-member','test-tradition',$1,'now')", [child.id]);

  const deletions = await Promise.all([deletePerson(req("/api/people/x", "DELETE", undefined, token), ctx(child.id)), deletePerson(req("/api/people/x", "DELETE", undefined, token), ctx(child.id))]);
  assert.deepEqual(deletions.map(r => r.status).sort(), [200, 404], "Concurrent deletion is atomic");
  assert.equal((await db.query("SELECT * FROM relationships")).length, 0);
  assert.equal((await db.query("SELECT * FROM prophecy_links")).length, 0);
  assert.equal((await db.query("SELECT * FROM tradition_people")).length, 0);
  assert.equal((await db.query("SELECT * FROM scripture_refs WHERE event_id='test-event'")).length, 1, "Independent event refs survive");
  const deleted = (await (await readRecovery(req("/api/owner/recovery", "GET", undefined, token))).json())[0];
  // A missing dependency must roll back the *entire* restoration.
  const missingParent = await archiveRecord("person", father.id);
  assert.equal((await restore(req("/api/owner/recovery/x", "POST", undefined, token), ctx(deleted.id))).status, 409);
  assert.equal((await db.query("SELECT * FROM people WHERE id=$1", [child.id])).length, 0);
  assert.equal((await db.query("SELECT * FROM deleted_records WHERE id=$1", [deleted.id])).length, 1);
  await restoreRecord(missingParent);
  await db.run("UPDATE people SET name='Renamed father' WHERE id=$1", [father.id]);
  const restored = await Promise.all([restore(req("/api/owner/recovery/x", "POST", undefined, token), ctx(deleted.id)), restore(req("/api/owner/recovery/x", "POST", undefined, token), ctx(deleted.id))]);
  assert.deepEqual(restored.map(r => r.status).sort(), [200, 404]);
  const [savedChild] = await db.query<{ timeline_start_bc: number; date_uncertainty_note: string }>("SELECT * FROM people WHERE id=$1", [child.id]);
  assert.equal(savedChild.timeline_start_bc, 1000);
  assert.equal(savedChild.date_uncertainty_note, "Test uncertainty");
  assert.equal((await db.query<{ person_a_name: string }>("SELECT * FROM relationships"))[0].person_a_name, "Renamed father");
  assert.equal((await db.query("SELECT * FROM prophecy_links")).length, 1);
  assert.equal((await db.query("SELECT * FROM tradition_people")).length, 1);
  const relRecovery = await (await deleteRel(req("/api/relationships/x", "DELETE", undefined, token), ctx(rel.id))).json();
  await restoreRecord(relRecovery.recoveryId);
  const refRecovery = await (await deleteRef(req("/api/refs/x", "DELETE", undefined, token), ctx(ref.id))).json();
  await restoreRecord(refRecovery.recoveryId);
  const patch = await editPerson(req("/api/people/x", "PATCH", { name: "Child renamed", id: "wrong", timelineStartBc: 10 }, token), ctx(child.id));
  assert.equal((await patch.json()).timelineStartBc, 1000, "Unsupported timeline edits cannot pretend to save");
  const eventData = await (await study(req("/api/study?book=Genesis&chapter=2"))).json();
  assert.equal(eventData.events.length, 1);
  assert.equal(eventData.refs[0].chapterStart, 1, "Broad event ranges remain explicit");
  assert.equal((await (await study(req("/api/study?book=Genesis&chapter=3"))).json()).events.length, 0);
  assert.equal((await study(req("/api/study?book=Notabook&chapter=1"))).status, 400);
  const exported = await exportLibrary();
  assert.equal(exported.tables.people?.length, 2);
  assert.equal(Object.keys(exported.tables).length, 8);
  assert.ok(!JSON.stringify(exported).includes(oldPasscode!));
  const download = await backup(req("/api/owner/backup", "GET", undefined, token));
  assert.match(download.headers.get("Content-Disposition")!, /attachment/);
  assert.equal(download.headers.get("Cache-Control"), "no-store");
  assert.equal((await logout(req("/api/owner/session", "DELETE", undefined, token))).cookies.get(OWNER_COOKIE)?.maxAge, 0);
  console.log(`Owner protection checks passed (${process.argv.includes("--libsql") ? "libsql" : "SQLite"}): public reads, all guarded writes, CSRF, encrypted sessions, rotation/expiry, shared rate limit, transactional deletion/recovery, full backup, passage events. Test-only database: ${path}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
