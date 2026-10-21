# Contributing to GhostInTheCodebase

Thanks for your interest in contributing — Ghost is built in public, one honest
step at a time.

## Ground rules

1. **No fabricated verdicts.** Anything displayed by the dashboard comes from
   the committed fixture or a real recording. If the engine cannot prove it,
   the UI must not show it.
2. **`npm run typecheck` must pass** before every commit you push. CI-friendly
   diffs are small and single-purpose.
3. **Contracts first.** `app/api/*`, `src/autopsy/engine.ts`, and
   `src/types.ts` define the demo's observable behavior. Changing them is a
   feature decision, not a drive-by edit — open an issue / proposal PR first.
4. **Secrets never enter the repository.** Config lives in `.env` (gitignored)
   following `.env.example`. If you find a secret committed anywhere, open an
   issue immediately.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
```

## Commit & PR style

- One concern per PR; the diff should match the title.
- Prefer conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.
- The TestSprite check runs on pull requests and blocks merge when red.
- Docs-only PRs are welcome and reviewed fast.

## Reporting issues

Include: what you did, what you expected, what happened, and — for bugs on
routes — the request/response pair. Specific beats polite.
