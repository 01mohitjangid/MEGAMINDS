#!/usr/bin/env bash
# Parallel gate runner for the MegaMinds build-feature loop.
#
# Runs the CI-cheap checks CONCURRENTLY (wall-clock ≈ the slowest one, not the sum)
# and prints a per-check PASS/FAIL summary. Exits 0 only if every check passed.
# cd's to the project root, so it runs from anywhere.
#
# Tuned to MegaMinds' current stack:
#   frontend — Vite + React + TypeScript (npm): oxlint + `tsc -b` typecheck
#   backend  — FastAPI + SQLAlchemy + Alembic (Python): no lint/type tooling yet
#
# The heavy `vite build` is intentionally NOT run here — `tsc -b` gives the type
# signal; leave the real build to CI as the final integration gate before merge.
#
# ADD MORE CHECKS as MegaMinds grows: enable the backend ruff/mypy lines once those
# tools are in backend/requirements.txt, and add a frontend formatter (prettier) if
# one is adopted. Add a `run <name> …` line AND put its name in `checks`.

set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$root" || exit 1

logd="$(mktemp -d)"
trap 'rm -rf "$logd"' EXIT

run() { # name cmd... — capture exit code + output to per-check files
  local name="$1"
  shift
  "$@" >"$logd/$name.out" 2>&1
  echo $? >"$logd/$name.code"
}

checks="fe-lint fe-types"

echo "▸ gate (parallel): $checks"
run fe-lint npm --prefix frontend run lint &
run fe-types bash -c 'cd frontend && npx tsc -b' &
# Backend — uncomment + add the names to `checks` above once tooling is set up:
# run be-lint  bash -c 'cd backend && ruff check .' &
# run be-types bash -c 'cd backend && mypy app' &
# run be-test  bash -c 'cd backend && pytest -q' &
wait

fail=0
for n in $checks; do
  code="$(cat "$logd/$n.code" 2>/dev/null || echo 1)"
  if [ "$code" = 0 ]; then
    printf '  PASS  %s\n' "$n"
  else
    printf '  FAIL  %s (exit %s)\n' "$n" "$code"
    sed 's/^/        /' "$logd/$n.out" | tail -12
    fail=1
  fi
done

echo "▸ gate: $([ "$fail" = 0 ] && echo GREEN || echo RED)"
exit "$fail"
