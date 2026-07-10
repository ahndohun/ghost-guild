# HANDOVER — Colosseum Survivors 오케스트레이터 인수인계 (2026-07-10 22:45 KST 기준)

이 문서는 Claude(fable) 어드바이저 세션에서 Codex로 게임 작업을 이관하는 인수인계다. 여기 적힌 상태는 커밋 `420d8be` 라이브 기준.

## 0. 미션

- **TestSprite Hackathon S3** 출품작. **마감 2026-07-11 08:59 KST** — 제출(폼+Discord 포럼)은 이미 접수 완료, 마감까지 리포·라이브 개선 반영.
- 리포: 이 문서가 있는 저장소 루트 · 라이브: https://colosseum-survivors.pages.dev (Cloudflare Pages 직접 배포)
- **루브릭 40%가 "TestSprite 검증 루프 기록"** — 매 사이클 LOOP.md에 남는다. 코드 개선만큼 루프 기록이 점수다.

## 1. 게임 정체성 (설계 불변)

- 컨셉: **검투사를 조작하지 않는다, 코칭한다.** 자율 AI 검투사 + 플레이어는 클래스·특성화 트리·영구 스탯·장비만 개입. 인게임 직접 조작 금지(보드 확정 디자인).
- 아키텍처 3층 완전 분리: 순수 TS 결정론 시뮬(`src/sim`) ⊥ Canvas 2D 렌더(`src/render`) ⊥ DOM UI(`src/ui`).
- **`src/sim` 순수성 규율**: `Date`·`Math.random`·DOM 금지. 난수는 seeded PRNG(mulberry32)만. 30tick/s. 같은 시드+같은 로드아웃 = 완전 동일 전투 — 이게 멀티(고스트 매치)의 기반.
- 멀티: 서버(Vercel 함수+Blob)는 로드아웃·시드만 교환. **장착 아이템 = 로드아웃의 일부** — 스키마 바꾸면 서버(`api/*.ts`)와 고스트 리플레이 호환을 같이 지켜야 한다.

## 2. 현재 상태 (전부 라이브)

- **로스터 v3**: 11클래스(Fighter/Knight/Berserker/Dwarf/Paladin/Mage/Priest/Warlock/Elf/Thief/Monk), 클래스 내장 기질(선택 UI 없음), 특성화 트리 5티어×2택=110노드, 스킬 6→18종. Gambler 제거 — 세이브·고스트는 thief로 자동 이관, 서버는 구 페이로드의 "gambler"를 read 시 리맵.
- **아이템 시스템 v1**: 희귀도 common/magic/rare/unique/set, 전투 중 자동 루팅, 180초 생존 시 그 런 희귀도 테이블 상향, 3슬롯(relicWeapon/armor/trinket)+길드 스태시, 유니크 11종(클래스 고정·규칙 변경)+세트 3벌. 어픽스는 트리 노드와 같은 `PerkEffect` 스키마 재사용.
- 게이트: typecheck 그린, vitest 89/89, 프로덕션 실플레이 검증 완료(아이템 루팅→스태시→장착 동작 확인).
- SSOT: 기획 상세 = `docs/roster-v3.md` · testid 표면·아트 디렉션 = `DESIGN.md` §9·§10 · 루프 기록 = `LOOP.md`(68번까지 확정).

## 3. 진행 중이던 것 (인수 즉시 처리)

1. **tsloop 69번째 사이클 완료 — raw 0/4, LOOP.md 69번 기록됨.** 4건 전부 트리아지 필요: 실패 번들은 `.testsprite/failure/`에 다운로드돼 있다.
2. 4건 내역과 1차 판독: ① "Guild screen derives identity from five classes" failed — 5클래스 시절 플랜, **확정 스테일**. 11클래스 현행 스펙으로 재생성. ② "Monk class embeds Berserker identity" failed — 스테일 의심(로스터 v3에서도 Monk 기질은 berserker 파생이 맞다 — 플랜의 다른 스텝이 낡았을 가능성). 실패 번들로 실회귀 여부 판정. ③ Arena unknown + ④ Solo blocked — 기존 문서화된 #221/저지 flake 계열 패턴(LOOP 63·65·67 선례). 클라우드 대시보드의 공식 상태와 대조 후, 스테일은 `test delete --confirm` 후 현행 스펙 `--plan-from`으로 재생성. **라이브 자체는 실플레이로 검증 완료 상태다(§2) — 0/4를 게임 회귀로 단정하지 말 것.**

## 4. 사이클 완료 정의 (절대 생략 금지)

구현 → `npm run typecheck && npm run test && npm run build` → main 푸시(자동배포) → 라이브 번들 교체 확인 → `node scripts/tsloop.mjs <maker> "<변경 한 줄>"` → LOOP.md 자동 기록 → 사용자에게 한국어 보고. **배포·tsloop·LOOP 없는 "완료"는 완료가 아니다.**

## 5. TestSprite 함정 (실측 누적)

- FE 테스트는 **개별 실행만** 가능(`test run --all`은 BE 전용) — `scripts/tsloop.mjs`가 이걸 처리한다. PROJECT_ID는 스크립트 상단에 있음.
- **#221 자기모순 판정**: 라벨 blocked/failed인데 판정문에 "PASS — all steps verified"가 들어있는 케이스 = 플랫폼 버그. 쫓지 말고 LOOP.md에 문서화(선례: 63·65·67번 라인).
- 저지 비결정성: 180초 런을 기다리지 않고 중도 판정하는 flake 존재. 재현 안 되면 문서화가 정답.
- 테스트 재생성은 `--plan-from` JSON: planSteps는 action/assertion, **한 스텝 한 동사, CSS 셀렉터 금지**, 고정 DOM 텍스트/testid 기준 assertion이 flake에 강하다.
- E2E 표면: DOM 미러 `#game-state`(data-phase/time/hp/level/class/temperament)와 `DESIGN.md` §9의 data-testid들. 표면 바꾸면 DESIGN §9 갱신 + 관련 클라우드 테스트 정합 확인.

## 6. 리포 관례·개발 함정

- dev: `npm run dev`(vite, 5173). 특정 상태 직행: `/?fast=1&seed=N`(타이틀 스킵+고속 시뮬), `?seed=N`(시드 고정).
- 시뮬 골든 테스트가 있다 — 의도된 밸런스 변경으로 골든이 깨지면 커밋 메시지에 원인 명시하고 골든 갱신(선례: `ee2e47f`).
- 세이브 포맷은 `src/ui/save.ts`의 마이그레이션 사다리 — 포맷 바꾸면 구버전 이관 경로 필수.
- codex 샌드박스가 `.git/index.lock`을 잠그면: GitHub API로 원격 fast-forward 푸시하고 로컬은 `git fetch && git reset --mixed origin/main`으로 정렬(선례 있음).
- 워커 위임 시: **재귀 codex 서브에이전트 스폰 금지**(토큰 폭주 사고 전례), grok 워커 최대 2기(`GROK_HOME` 분리), 워커 self-report는 불신하고 diff·실행으로 직접 검증.

## 7. 남은 백로그 (우선순위순)

0. **[보드 직접 리뷰 2026-07-10~11] 게임 품질 대개편 3계획 — 현재 최우선.** ① AI 대개편: `docs/plans/ai-overhaul-plan.md` (우측 러시·겹침·벽 비비기 = 코드 원인 확정, 컨텍스트 스티어링 승격 — **W1 버그 소거가 만사 최우선**) ② 클래스 개성: `docs/plans/class-identity-plan.md` (P1~P5 + P1.5 기계적 개성, 동일 스프라이트 블라인드 테스트 게이트) ③ 적·스테이지 콜로세움화: `docs/plans/colosseum-bestiary-plan.md` (3막 프로그램, 리스킨 A안 sim 무변경). **소유권 주의: movement.ts는 ①W2-6과 ②P1.5(a)가 겹친다 — 이 둘은 같은 워커·같은 사이클로 통합.** ③은 render/에셋 소유라 병렬 가능. ④ 로비 IA/UX 재설계: `docs/plans/ui-ia-redesign-plan.md` (이름 입력 온보딩화·탭 4→3·Gear→Inventory·출전 단일 버튼+모달·설정 팝오버 — src/ui 소유라 ①②③과 병렬 가능, 단 진행 중인 ui WIP와는 통합). 권장 순서: ①W1 → ②P1+P1.5(a)+①W2 통합 → ②P2·③A·④ 병렬 → ②P4 → 나머지.
1. §3의 진행 중 3건.
2. **스킬 18종 시각 이펙트 검수** — 스펙 게이트: "어떤 두 스킬도 화면에서 같아 보이면 안 된다"(`docs/roster-v3.md`). 신규 12종이 실제로 구별되는지 실플레이로 확인, 미달분 보강.
3. **아이템 볼륨**: 현재 정의 43개(베이스23+유니크11+세트9) vs 스펙 60-80. 어픽스 풀 확장 또는 베이스 추가.
4. 클래스 판타지 게이트 재검수: `docs/roster-v3.md`의 클래스별 한 줄 기대 판타지 대비 실플레이 체감.
5. README 데모 GIF가 구버전 UI — 갱신.
6. 밸런스: 11클래스가 같은 시드에서 유의미하게 다른 결과를 내는지(클래스별 스모크는 test에 있음, 체감 검증은 별개).

## 8. 검증 원칙

빌드·테스트 그린은 게이트의 절반이다. **출고 게이트 = 처음 보는 사람 시점의 실플레이**(라이브에서 클래스 선택→출격→루팅→복귀→장착까지 직접). 시각 변경은 스크린샷을 `docs/screenshots/`에 남긴다.
