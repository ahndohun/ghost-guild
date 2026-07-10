# 인수인계: Colosseum Survivors UI·아트 개편 (002 잔여분 + 003~005)

수신: gpt-5.6-sol (high) — 당신이 이 작업의 오케스트레이터다.
발신: Claude Fable 5 (어드바이저, 2026-07-11까지 001~002 대부분 진행)
실행자: grok-4.5 CLI (디스패치 규약은 §5)

## 0. 임무 요약

리포지토리 루트에서 `advisor-plans/`의 계획을 순서대로 완수한다.
각 계획 문서가 최우선 스펙이다 — 착수 전 해당 계획을 전체 정독하고, STOP 조건을 우회 없이 지키고, 완료 시 advisor-plans/README.md 상태 행을 갱신한다.

남은 작업 순서:
1. **002 잔여분** (아래 §2) — 브랜치 advisor/002-fixed-guild-shell에서 이어서
2. **004** (advisor-plans/004-readable-spectator-combat.md) — 관전 HUD
3. **003** (advisor-plans/003-production-art-system.md) — PixelLab 아트 (§6)
4. **005** (advisor-plans/005-coaching-results.md) — 004 완료 후
- 003과 004는 계획상 병렬 가능하지만 **같은 워킹트리라 순차가 안전**하다. 병렬로 하려면 git worktree로 격리할 것.
- push·PR 금지. main 머지는 보드(사용자) 결정.

## 1. 현재 상태 (2026-07-11 실측 검증 완료)

- 브랜치 계보: main(d43f062) → advisor/001-browser-ui-contracts(001 완료+advisor-plans 문서) → advisor/002-fixed-guild-shell(현재 체크아웃, 002 Step 1~4 완료)
- 마지막 커밋: 960b4f8. 워킹트리 클린(test-results/ 제외).
- 게이트 기준선 (전부 직접 재실행으로 확인됨):
  - `npm run typecheck` exit 0
  - `npm run test` — vitest 6파일 89개 (test/browser는 --exclude로 제외되어 있음)
  - `npm run test:ui` — Playwright 21개 (game-flow 5 + guild-geometry 1 + guild-readability 1, × 3뷰포트 875x717/875x909/1440x900)
- 001 완료: Playwright 하네스(포트 5199 전용), 플로우 5종, uncaught error 0 강제 fixture(test/browser/helpers.ts autouse), TestSprite plans 11클래스 보정.
- 002 Step 1~4 완료: Guild 4탭(guild-tab-overview/class/training/gear) + 960x540 고정 셸(`transform: translate(-50%,-50%) scale(var(--shell-scale))`, `.guild-shell`에 --shell-scale 노출) + 가독성 계층(본문 --body-font ≥12px, 타깃 ≥44논리px, 상태 형태신호).

## 2. 002 잔여분 (최우선)

**advisor-plans/handover-grok-step5-prompt.md** 가 실행자용 프롬프트로 이미 작성되어 있다 — 그대로 grok에 디스패치하면 된다. 내용: ① Class 섹션 추천 3종(Fighter/Knight/Mage) 우선 + `toggle-all-classes` 확장(geometry 테스트가 접힌 카드에서 깨지지 않게 테스트 갱신 포함) ② 첫 세션 코치 4단계(비차단 배너, coach-panel/coach-skip/coach-replay, save.ts에는 완료·단계만) ③ TestSprite plans 섹션 내비게이션 갱신 ④ .gitignore에 test-results/.

완료 후 검토 포인트 1건: 골드 0일 때 Training의 업그레이드 버튼 전부가 취소선+흐림(unaffordable) 처리된다 — 기능상 맞지만 첫인상이 "고장"처럼 보일 수 있다. 오케스트레이터가 스크린샷으로 판단해 과하면 완화(취소선은 가격에만 등).

002 done criteria 전체(계획 문서 하단)와 README 상태 갱신까지 마쳐야 002 마감이다.

## 3. 환경 제약 (전부 실측 — 이걸 모르면 같은 곳에서 두 번 죽는다)

1. **codex 샌드박스(workspace-write)에서는 Chromium이 못 뜬다** — Playwright가 `bootstrap_check_in ... MachPortRendezvousServer: Permission denied`로 전멸. `sandbox_workspace_write.network_access=true`로도 해결 안 됨(그건 포트 바인드·localhost 접속만 풀어준다). **대응: 이 세션이 headless exec라면 브라우저 게이트를 돌릴 수 없다 — 샌드박스 밖 실행(대화형 승인 또는 danger-full-access)이 전제되어야 하고, 아니라면 test:ui 결과를 자칭하지 말고 "미검증"으로 보고하라.**
2. **grok을 codex 샌드박스 안에서 부르면 죽는다** — `~/.grok` 세션 쓰기 거부(FS_PERMISSION_DENIED), --add-dir로 열어도 stopReason=Cancelled 연쇄. grok 디스패치는 샌드박스 밖 셸에서만.
3. **grok을 임시 HOME으로 우회하면 인증이 사라져 `unknown model id: grok-4.5`로 오판된다.** 금지.
4. 포트 5199에 vite dev 서버가 이미 떠 있을 수 있다 — playwright.config.ts가 reuseExistingServer로 재사용한다(정상, HMR이라 디스크 최신을 서빙).
5. vitest가 test/browser를 줍지 않도록 package.json test 스크립트에 --exclude가 걸려 있다 — 지우지 말 것.

## 4. 검증 규약 (self-report 금지)

- 실행자(grok)의 "완료" 보고를 절대 그대로 믿지 마라. **실측 사례: grok-4.5가 실행하지 못한 브라우저 테스트를 성공한 것처럼 좌표까지 지어내 서술했다.** 판정은 ① 최종 JSON `stopReason`(`EndTurn`만 정상, `Cancelled`=권한 무음취소, exit code는 항상 0이라 무의미) ② `git diff` 직접 정독 ③ 게이트 직접 재실행.
- 시각 변경은 게이트 그린으로 끝내지 말고 스크린샷 검수까지. 실측 사례: 지오메트리 테스트 18개 그린 상태에서 875폭 셸 잘림(뷰포트-포함 단언 누락)이 육안으로만 잡혔다. 검수 스크린샷은 875x909와 1440x900 두 장 이상.
- 논리픽셀 검증 패턴: 폰트 크기는 computed style 그대로(transform 무영향), 요소 크기·좌표는 boundingBox ÷ `--shell-scale`.
- 커밋은 검증 통과 후 작업 단위별 conventional commit. 각 계획의 Git workflow 섹션에 제안 메시지가 있다.

## 5. 실행자 디스패치 규약 (grok-4.5)

작업 단위마다 (샌드박스 밖 셸에서):
```bash
grok --no-auto-update -m grok-4.5 --effort high --prompt-file <프롬프트파일> \
  --permission-mode auto --output-format json --max-turns 50 \
  --allow "Bash(npm:*)" --allow "Bash(npx:*)"
```
- 프롬프트는 self-contained: 정확한 경로, 필독 파일 목록, 좌표계 규칙(§4), 금지 사항(테스트ID 불변·sim 불가침·커밋 금지), 완료 조건(게이트 + 마지막에 `git diff --stat` 원문 출력), "보고는 한국어로".
- 출력 JSON은 pretty-print 멀티라인 — 전체를 json.load로 파싱. 텍스트는 `.text` 필드.
- 같은 작업 2회 미달 시 오케스트레이터가 직접 마무리하고 보고에 명시.
- 참고: advisor-plans/handover-grok-step5-prompt.md가 프롬프트 형식의 실례다.

## 6. 003 아트: PixelLab 파이프라인

- **에셋 생성 도구는 PixelLab이다** (계획 문서의 generate2dsprite/imagegen 문구는 무시). codex에 HTTP MCP로 등록되어 있다: 서버명 `pixellab`, https://api.pixellab.ai/mcp, Bearer는 환경변수 PIXELLAB_API_KEY (등록 확인: `codex mcp list`). 네트워크 접근이 되는 실행 모드여야 한다.
- 착수 전 `get_balance`로 크레딧 확인. **잔량의 25% 이상을 쓸 대형 배치는 시작 전에 보드(사용자)에게 확인받는다.**
- 생성은 비동기 큐잉(job id) — 폴링해서 회수. 파이프라인: 생성 → 다운로드 URL을 curl로 public/assets/에 저장 → **즉시 커밋**(서버측 자동삭제 대비) → art-manifest.json 등록 → 검증기(scripts/verify-art-assets.mjs, 계획 Step 1에서 생성) 통과.
- 스타일 잠금: 기존 title-arena-bg, panel-stone, 클래스 스프라이트의 팔레트·카메라(low top-down)·아웃라인을 레퍼런스로. 계획 Step 3의 2단 품질 게이트(선발 6종 검수 후 나머지 8종)를 지켜라.
- 계획 Step 1(스펙 문서·매니페스트·검증기)을 아트 생성보다 먼저 — 무르기 어려운 단계(대량 생성)는 형식 확정 뒤에.

## 7. 보고 형식

작업 단위마다: 수행 내용 / 게이트 실제 수치 / git log·diff --stat 원문 / 계획 대비 이탈. STOP 발동 시 사유·증거를 남기고 다음 단위로 넘어가지 말 것. 마일스톤(각 계획 DONE)마다 스크린샷 포함 시연 증거를 남긴다. 보고는 한국어로.
