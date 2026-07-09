# Ghost Guild — Worker Conventions

Read DESIGN.md first — it is the single source of truth for game rules and numbers.

## QA invariants (모든 게임플레이 작업의 완료 조건)

- **도달 가능성 불변식**: 위치를 갖는 모든 생성물(적 스폰·드롭·투사체 목표·순찰 지점)은 영웅이 물리적으로 도달 가능한 영역 안에 있어야 한다 — 드롭은 벽 안쪽 inset으로 클램프. 위반은 "영웅이 벽에 대고 버벅거리는" 부류의 버그가 된다 (2026-07-10 보드 실플레이에서 발견된 실제 사례).
- 위치·이동을 만지면 property 테스트를 추가/갱신: 여러 시드 완주 후 전 드롭 좌표가 도달 영역 안인지 assert.
- 새 행동 규칙(AI)을 넣으면 "영웅 장기 정지"가 생기지 않는지 확인: 정상 런에서 3초 이상 20px 반경에 갇혀 있는 구간이 없어야 한다 (전투 포위 제외).

## Hard rules
- `src/sim/` is pure TS: no DOM, no Date.now, no Math.random, no imports from render/ui. All randomness via the seeded PRNG passed in. Violating this breaks multiplayer determinism (Pillar 3).
- Every interactive DOM element gets a `data-testid` exactly as named in DESIGN.md §9 — the E2E suite depends on them.
- Before reporting done: `npm run typecheck && npm run test` must pass. Fix, don't skip.
- Keep deps minimal — no game engines, no UI frameworks. Vite + TS + vitest only unless told otherwise.
- Code style: double quotes, camelCase, small modules per system (movement, weapons, waves, loot, levelup).

<!-- BEGIN TESTSPRITE AGENT SECTION (testsprite agent install codex) -->
# TestSprite Verification Loop

After finishing a feature or fix in a TestSprite-tested repo, use the `testsprite`
CLI to run the relevant TestSprite tests against the change and inspect any failure
artifacts before reporting the work as done. Use whenever code has changed outside
docs/config and is about to be reported complete.

## When to run

Run after a feature or fix lands. Skip only for: docs-only edits, pure
build/config changes, or when the repo has no TestSprite project linked.

## Core loop

### 1. Preflight

```bash
testsprite --version          # CLI installed?
testsprite auth whoami        # credentials valid?
```

If `--version` fails, tell the user to install the CLI and stop.
If `auth whoami` fails, tell the user to run `testsprite auth configure` and stop.

### 2. Find the project

In order: `$TESTSPRITE_PROJECT_ID` → `.testsprite/config.json` → `testsprite project list --output json`.

### 3. Run

```bash
# New frontend test from plan (most common)
testsprite test create --plan-from plan.json --run --wait \
  --target-url https://staging.example.com --timeout 600 --output json

# Existing test
testsprite test run <test-id> --target-url https://staging.example.com \
  --wait --timeout 600 --output json

# New backend test from Python assertion file
testsprite test create --type backend --name "Login rejects empty password" \
  --project <id> --code-file /tmp/test.py --run --wait --timeout 600

# Replay (cheaper than a fresh run — reuses saved test code)
testsprite test rerun <test-id> --wait --output json

# Backend tests sharing state: declare the dependency graph at create time;
# the wave engine orders runs (producers → consumers → teardown last)
testsprite test create --type backend --project <id> --code-file /tmp/login.py \
  --name "login issues an auth token" --produces auth_token
testsprite test create --type backend --project <id> --code-file /tmp/profile.py \
  --name "profile update accepts the token" --needs auth_token
testsprite test create --type backend --project <id> --code-file /tmp/cleanup.py \
  --name "fixture user is deleted" --category teardown

# Wave-ordered batch fresh run (BE tests, all or filtered)
testsprite test run --all --project <id> [--filter <substr>] \
  --wait --max-concurrency 4 --output json
```

**Key behaviors:**

- `--target-url` must be publicly reachable (no localhost / RFC1918) and must
  already have the change deployed (e.g. a CI preview deploy) — the CLI tests a
  deployed URL, it doesn't host your environment. Running earlier verifies the
  previous build.
- Backend `--code-file`: the runner executes the file top-to-bottom (not `pytest`), so **call your `test_*` function(s) at the end of the file** — a defined-but-uncalled test silently passes.
- Backend sandbox has only stdlib + `requests` + `pytest` + `numpy` + `scipy`. Test the API over HTTP with `requests`; do **not** `import` the project's own source modules or other packages (e.g. `torch`) — they aren't installed and the test won't run.
- `--wait` long-polls until terminal. Do not wrap it in a retry loop.
- Exit `0` = passed; `1` = failed/blocked; `7` = timeout (resume with `test wait <run-id>`).
- BE dependency flags (`--produces`/`--needs`/`--category`) are backend-only and
  **create-only** — they can't be read back or edited later (delete + recreate to
  change the graph). Don't hand-sequence `test run` calls to fake ordering; use
  `test run --all` so the engine passes captured variables between waves.
- A BE `test rerun` dispatches the whole producer/teardown closure, side effects
  included; `--skip-dependencies` reruns only the named test. If a producer failed
  in the same closure, the consumer's failure is starvation (missing token/fixture)
  — triage the producer first; it does not implicate your change.
- `create` and `--wait` output include a `dashboardUrl` — if the user wants to
  inspect a test or run themselves, point them there.

### 4. On failure — download the artifact

```bash
testsprite test artifact get <run-id> --out ./.testsprite/runs/<run-id>/
```

Inspect the bundle (failing step, screenshots, root-cause hypothesis) before
deciding whether your change caused the failure.

### 5. One more tool — dry-run for learning

Every command works without credentials under `--dry-run`:

```bash
testsprite test run <test-id> --dry-run --output json
testsprite test create --plan-from plan.json --dry-run --output json
```

## Exit-code quick reference

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | Success (passed)                                  |
| 1    | Failed / blocked / cancelled                      |
| 3    | Auth error                                        |
| 4    | Not found                                         |
| 5    | Validation error                                  |
| 6    | Conflict (already running)                        |
| 7    | Timeout — resume: `testsprite test wait <run-id>` |
| 11   | Rate limited (retriable)                          |
| 12   | Insufficient credits                              |

## Bootstrap (first-time setup)

```bash
npm install -g @testsprite/testsprite-cli
testsprite setup         # configure + verify + install agent skill in one shot
```

Verify your setup anytime: `testsprite auth status`.

**First-time setup:** if this repo has no TestSprite tests yet, seed a *broad* first suite across its main user flows — not just one test — each with a concrete, observable assertion, before reporting setup as done.
<!-- END TESTSPRITE AGENT SECTION -->
