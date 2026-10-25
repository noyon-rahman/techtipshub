# Taste — Command Code

## Communication & workflow
- When debugging platform/infrastructure errors, expects genuine research (official docs, upstream source, issue trackers) rather than guesswork — and asks for it explicitly ("do some real research"). Cite the sources used. Confidence: 0.75
- Wants a root-cause diagnosis plus concrete evidence that the fix works (typecheck/lint/format/build run), not just a patch. Confidence: 0.6

## Tooling & stack
- Works in pnpm + Turborepo monorepos with `apps/` and `packages/` layout, TypeScript throughout; deploys to Vercel. Confidence: 0.6
- Uses Hono as the API framework on Node (`@hono/node-server`), with separate entrypoints for the long-running dev server vs. the serverless handler. Confidence: 0.5
