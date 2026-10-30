# Birdseye improvements

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
