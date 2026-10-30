# Birdseye improvements

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
