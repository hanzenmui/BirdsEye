# Birdseye

A Bible atlas for people, families, scripture references, and biblical and church
history. Reading is public; changing the library requires owner access.

## Owner tools and recovery

- In hosting settings, set `ADMIN_PASSCODE` to a strong, unique passcode of at
  least 8 characters and `AUTH_SECRET` to a random secret of at least 32 characters.
  Never commit either value. Redeploy after changing hosting settings.
- Open **Owner tools** in navigation to sign in. Reading never requires a passcode.
  Missing configuration disables editing, not reading.
- Sessions last up to 8 hours. Changing either credential revokes existing
  sessions. Signing out removes editing access from that browser.
- Sign-in permits 10 attempts per 15-minute window, shared across app instances.
  After the limit, even a correct passcode must wait for that window to expire.
- **Recently deleted** restores removed people with references, relationships,
  prophecy links, and tradition memberships. Individual references and
  relationships are recoverable too. Restore missing related people first.
  Conflicts roll back the whole restoration; existing records are never
  overwritten. Recovery covers deletions made after this update only.
- **Download library backup** exports the full library plus recovery records as
  JSON, excluding credentials and sign-in attempts. Keep that file separately
  before major changes. This is manual export, not automated off-site backup,
  edit-history undo, or one-click database import. Recovery records are in the
  same database and do not protect against losing that database.

## Chapter study

Choose a book and chapter for its names, connected family preview, and historical
events with explicit scripture links covering that chapter. Broader reference
ranges do not prove a name appears in every covered chapter. Whole-book timeline
spans are not chapter dates. The preview shows up to 12 connected names; the full
passage map includes everyone, including disconnected people.

## Verification

- `npm run verify:owner` uses disposable local databases for both adapters and
  dummy credentials; it never loads the production environment.
- `npm run verify:chapter-study`, `verify:reading-workflow`,
  `verify:reference-search`, and `verify:layout` check pure study/navigation logic.
- `verify:timeline` and `verify:traditions` read the configured database. Override
  `TURSO_DATABASE_URL` with a temporary file database to verify a preview instead.
- `npx tsx scripts/prepare-study-preview.ts` copies the configured library into a
  temporary local database using read-only source queries.

Next.js 16.4, React 19, TypeScript, SQLite/Turso. Content audits are separate from
interface/safety verification. Run local servers from the real project directory,
not a Windows junction.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app uses locally served Fraunces headings and Red Hat Text body type. The
main reading interface is `components/Explorer.tsx`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
