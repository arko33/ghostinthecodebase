---
name: Pull request
about: One concern per PR. TestSprite runs on PRs and blocks when red.
title: "feat/fix/docs: <short imperative summary>"
labels: ''
assignees: ''

---

## What

<!-- one paragraph: what changes and why -->

## How it was found / why it matters

<!-- bug report steps, or the failure record the fix closes -->

## Checklist

- [ ] Single concern; diff matches the title
- [ ] `npm run typecheck` passes locally
- [ ] No secrets or sensitive data in the diff
- [ ] Tests/behavior verified against the live or local app
