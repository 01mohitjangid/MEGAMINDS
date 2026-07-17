---
name: build-feature
description: Use when building a feature, fixing a bug, or making any code change in the MegaMinds project that must land CI-green. Triggers on /build-feature, "build/implement/add/fix X", "make this pass CI", or prep before a PR. Runs a maker≠checker loop that ends every change green against the real CI gate.
---

# build-feature

A maker≠checker build loop for the **MegaMinds** project. **You are the maker.**
You plan and write code, self-clean it, run the gate, then dispatch the
**`megaminds-verifier`** agent (the checker — it has no edit tools) to
independently confirm. You iterate until the verifier says PASS.

**Core principle: every change ends CI-green.** "Green" = the exact gate the
project's CI runs (mirror it in [`gate.sh`](gate.sh) — see "The gate" below).
Done is not "I wrote it" — done is "the verifier ran the gate and it passed."

> First run in a fresh MegaMinds? See **Project setup** at the bottom — point the
> gate at MegaMinds's real check commands before trusting a green.

## Decision policy (bake this in)

- **Default to deciding and proceeding.** Make the reasonable call, note the
  assumption in one line, keep moving.
- **Batch genuine clarifications into ONE round up front**, before coding. After
  that, don't ask — decide.
- **Never ask "should I continue?"** Just continue.
- **Autopilot — plan, then build; don't ask to start.** Once the task is clear,
  state your approach + assumptions in 1–2 lines and **go straight into building**.
  Do NOT present the plan as an approval gate or enter plan mode. The end-of-loop
  gate + the verifier + the PR you open at the end are the safety net — not an
  up-front sign-off.
- **Stop mid-task only** for irreversible, scope-changing, or product-risk calls
  (schema/data migrations, deleting user data, public API changes, new paid
  dependency, security/auth changes). For those, surface and wait. A layout tweak,
  a new component, reusing existing pieces — none of these qualify; just build them.
- **Never** edit real `.env*` files, schedule or automate anything, or
  push/commit/PR without explicit OK from the user.

## Speed & token discipline (read first — this is where runs go slow)

The loop gets slow from **wasted calls**, not from hard work. Hold to these:

- **Batch reads/greps into ONE message.** Independent file reads and searches run
  concurrently — never walk files one tool call at a time. Hand any broad/unsure
  search to an **Explore** subagent and use its conclusion; don't re-grep yourself.
- **One gate run per iteration.** `gate.sh` runs the checks in parallel. Don't run
  each check individually "to check" before or after it, and **never** run the full
  production build locally if CI covers it — that's usually the single biggest time
  sink.
- **Don't re-read what you just wrote.** Edit/Write already confirm success.
- **Edit, don't rewrite.** Prefer targeted `Edit` over re-Writing whole files.
- **Fix in batches before re-gating.** When the gate is red, fix _all_ the red
  items, then re-run once — not re-run after each single fix.
- **Verifier runs the gate; you don't double-run it.** After you've gated green,
  dispatch the checker — don't run the full gate a third time yourself first.

## The loop

Create a todo per step. Run them in order; the iterate step is the loop.

1. **Load context.** Read [`TRAPS.md`](TRAPS.md) (this dir) and any project
   conventions MegaMinds documents (its `README`, an `AGENTS.md`/`CLAUDE.md`, or a
   `.claude/rules/` folder if one exists) for the area you're touching. **Gather in
   parallel:** batch independent reads/greps into ONE message, or hand a broad
   search to an **Explore** subagent — don't walk files one command at a time.
2. **Frame it (internally, autonomous).** Think through intent, requirements, and
   design. Ask a question ONLY if a genuine ambiguity or product/risk call truly
   blocks you, and batch it into ONE round here. For a clear task, state your
   assumptions in one line and keep moving.
3. **Plan, then go.** For non-trivial work, lay out the step list. Show it as a
   brief FYI if it helps — but do **not** stop for approval and do **not** enter
   plan mode. Proceed straight into building.
4. **Build (TDD when a runner exists).** If MegaMinds has a test runner, use
   **superpowers:test-driven-development** (RED→GREEN→REFACTOR) for pure logic.
   Otherwise the correctness contract is **types + lint + the gate** plus targeted
   manual verification — lean on named types and validators as the "spec." When a
   bug/test failure/unexpected behavior shows up, use
   **superpowers:systematic-debugging** before guessing at a fix.
5. **Auto-fix the touched files** (mirror the project's pre-commit / formatter):
   ```bash
   # tune to MegaMinds's toolchain
   <formatter> --write <touched files>
   <linter> --fix <touched files>
   ```
6. **Run the gate** via [`gate.sh`](gate.sh) — it runs the CI-cheap checks
   **concurrently** in one pass (wall-clock ≈ the slowest, not the sum):

   `bash .claude/skills/build-feature/gate.sh`

   Run it once per iteration. Fix everything red and re-run before moving on.
   REQUIRED before claiming green: **superpowers:verification-before-completion** —
   run it, read the real output, don't assert from memory.
7. **Dispatch the checker.** Launch the **`megaminds-verifier`** agent (Agent tool)
   with: the feature, the touched area, and the base branch (default `main`). It
   runs the full gate, reviews the diff against project conventions, checks
   commits, and returns a fixed-shape report. You never self-certify — the checker
   is a separate agent with **no edit tools** (maker≠checker is non-negotiable).

   When it returns, print a one-line **scorecard** first — the checker, whether it
   ran, its VERDICT, and blocker count. Example:
   `Checker · verifier=PASS (0 blockers)`

   > Optional extra checkers for later: once MegaMinds has an architecture doc, add a
   > `megaminds-architect` checker for placement/layering; once it has a design
   > system, add a `megaminds-design-reviewer` for theme/UX. Dispatch applicable
   > checkers in the SAME parallel batch and treat each `[blocker]` as
   > gate-equivalent.

8. **Iterate.** If the verdict is FAIL or has `[blocker]` findings, fix them (back
   to step 5) and re-dispatch. **HARD STOP at 8 iterations** — if it's still not
   green, stop and report what's blocking with the verifier's last output. Don't
   loop forever; don't weaken the gate to force a pass.

## Learning loop

When the verifier's report includes a **NEW TRAP**, append it (one line) to
[`TRAPS.md`](TRAPS.md) before finishing — the single source of truth for MegaMinds's
repo traps. That's how the loop gets smarter each run. Editing TRAPS.md is the one
expected place you write outside the feature.

## Commit & PR conventions

- **Don't commit/push/PR without explicit OK** from the user (see decision policy).
- When asked to commit: **Conventional Commits** — `type(scope): subject`, type in
  `feat|fix|chore|refactor|docs|test|perf|style|build|ci`.
- Branch off `main` for feature work; never commit straight to `main`.
- Before a PR, the full gate must be green AND the verifier PASS.

## The gate

[`gate.sh`](gate.sh) is the cheap half of CI — the checks that must pass before a
change is done, run in parallel, exit non-zero on any failure. **It's already tuned
to MegaMinds:** frontend `oxlint` (`fe-lint`) + frontend `tsc -b` typecheck
(`fe-types`). The heavy `vite build` is left to CI — `tsc -b` is the local type
signal. The backend (FastAPI/Python) has no lint/type tooling yet, so `gate.sh` has
commented `ruff`/`mypy`/`pytest` lines ready to enable once those are added — add
the check to the `checks=` list at the same time. Until then, verify backend changes
by running the app.

## Red flags — stop and correct

- About to ask "approve and I'll build it?" or enter plan mode on a non-risky
  change → don't; the loop is autopilot. State assumptions in one line and build.
- About to mark done without the verifier returning PASS → not done.
- About to push/commit/PR without explicit OK → stop, ask.
- "I'll loosen the lint/type rule to get green" → no; fix the code.
- Looping past 8 iterations → stop and report.

## Maker≠checker

You write; `megaminds-verifier` judges. Never collapse the two — don't skip the
verifier because "it's obviously fine," and never give the verifier edit tools.
The independent gate run is the whole point.

## Project setup (first run in MegaMinds)

This skill was ported from a mature project's loop and tuned to MegaMinds' stack
(Vite/React/TS frontend + FastAPI/Python backend). Notes for your first real runs:

1. **`git init` first.** MegaMinds isn't a git repo yet — the loop's diff/commit
   steps and the verifier (which diffs against `main`) need one. Init it and set the
   base branch.
2. **Backend checks are stubbed, not active.** `gate.sh` only checks the frontend
   today. When you add `ruff`/`mypy`/`pytest` to `backend/requirements.txt`,
   uncomment their lines in `gate.sh` and add them to the `checks=` list.
3. **Seed conventions.** As MegaMinds grows, record its architecture and rules in an
   `AGENTS.md`/`CLAUDE.md` (or `.claude/rules/`) so the verifier can check the diff
   against them — and append gotchas to `TRAPS.md` as you hit them. Add a
   `megaminds-architect` / `megaminds-design-reviewer` checker when there's an
   architecture doc / design system to check against.
