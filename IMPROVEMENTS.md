# Birdseye improvements

## 2026-10-30 - Stop old owner checks from reversing sign-in or sign-out

- Changed: Initial, focus, polling, and explicit owner-status checks share one
  request version. Late results and errors from older checks are ignored, as
  are responses after cleanup. Malformed current replies disable editing.
- Benefit: Prevents a slow background reply from hiding editing after sign-in
  or showing it again after sign-out. Passcodes, session duration, and server
  authorization are unchanged; a current failed check still fails closed.
- Checked: New controlled-response tests cover out-of-order sign-in/out, stale
  errors, current errors, malformed replies, and cleanup/remount. Both isolated
  owner/database checks, targeted lint, and production build passed. Local
  desktop sign-in and 375px sign-out checks confirmed editing controls change
  correctly while reading stays open, with no console errors. Tests used dummy
  credentials and disposable data; production deployment was not checked.

## 2026-10-30 - Keep connection names current after renaming

- Changed: Connection labels use the current people index rather than the old
  names saved on relationship records. People profiles and family-tree details
  update immediately after a successful rename, without another loading step.
- Benefit: Fixes a reproduced case where a renamed parent still appeared under
  the old name in the child's connections until refreshing. IDs, relationships,
  ordering, and notes stay unchanged; unloaded people keep the saved fallback.
- Checked: New relationship-name checks cover both ends, repeated names,
  fallbacks, Unicode, and immutable records. Library-request, reading-workflow,
  chapter-study checks, targeted lint, and production build passed. Local
  desktop and 375px tests verified parent and child renames in profiles and
  family-tree details without refreshing; no console errors. Only disposable
  records changed. Live data and production deployment were not checked.

## 2026-10-30 - Explain failed saves without clearing the form

- Changed: Person, scripture-reference, and relationship forms show the server's
  explanation beside Save, including duplicate connections and invalid ranges.
  Person length errors state the limit. Failed removals use the same safe error
  handling. Unexpected server details are hidden; writes are not auto-retried.
- Benefit: Fixes silent person-save failures and vague retry notices. Typed
  descriptions and notes stay in the open form so entries can be corrected.
- Checked: New library-request regression checks, both isolated owner/database
  checks, reading-workflow checks, targeted lint, and production build passed.
  Desktop and 375px browser checks covered rejected person creation/editing,
  duplicate relationships, invalid references, retained text, and corrected
  successful saves. Only disposable test records changed. This is not draft
  storage across navigation/sign-out; production deployment was not checked.

## 2026-10-30 - Patch known security warnings

- Changed: Updated Next.js and its matching lint tools from 16.4.0 to 16.4.3,
  and the indirect development dependency Zod to 4.6.7. No screens, Bible data,
  access rules, or credentials changed. Prioritized this over a save-message
  draft, which was removed rather than shipped as a second improvement.
- Benefit: Removes the reported critical framework advisories and the remaining
  development-tool advisory. This is a dependency patch, not a claim that every
  possible app security issue has been audited.
- Checked: Full dependency audit reports zero known vulnerabilities. Production
  build and targeted lint passed. Owner checks passed on both isolated database
  adapters; chapter study, reading workflow, all 19 reference-search cases, and
  timeline-layout checks passed. Local desktop/375px browser checks covered
  chapter reading, a profile, family-map navigation, and timeline opening with
  no console errors. Optimized logo returned HTTP 200. Tests used disposable
  local records; live data and the production deployment were not changed or
  verified by these checks.

References: [Next.js image-optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Next.js cache advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr).
