너는 현재 저장소 루트(이미 cwd)에서 기능 작업을 수행하는 프론트엔드 개발자다. 현재 브랜치 advisor/002-fixed-guild-shell에서 그대로 작업한다. 브랜치 전환·커밋·push 금지 — 파일 수정과 테스트 실행만. 보고는 한국어로.

## 착수 전 필독
1. advisor-plans/002-fixed-guild-shell.md 의 Step 5, Step 6 섹션과 "Target layout contract" (스펙 원문)
2. src/ui/save.ts (저장 구조), src/ui/screens.ts, src/ui/markup.ts, src/ui/screenUtils.ts (`setActiveGuildSection`)
3. test/browser/game-flow.spec.ts, guild-geometry.spec.ts (기존 계약 — 깨면 안 됨)
4. plans/guild-screen.json, plans/trait-tuning.json (TestSprite 포맷)

## 좌표계 규칙
Guild는 960x540 논리 셸을 `transform: translate(-50%,-50%) scale(var(--shell-scale))`로 스케일한다. 새 UI도 이 셸 안에 넣어라(뷰포트 직접 기준 배치 금지).

## 작업 1 — Class 섹션 추천 3종 우선 노출
- Class 섹션에서 Fighter, Knight, Mage 카드를 "추천" 그룹으로 먼저 보여주고, 나머지 8종은 "All Classes" 확장 토글(신규 data-testid `toggle-all-classes`) 뒤에 배치. 접힘이 기본.
- 11종 전부 무료·선택 가능 유지. 기존 `class-*` testid 이름 불변.
- **기존 테스트 파급 처리 (필수)**: test/browser/guild-geometry.spec.ts는 각 섹션의 모든 data-testid 컨트롤 boundingBox를 검사한다 — 접힌 카드는 boundingBox가 null이라 실패한다. geometry 테스트의 class 섹션 순회 직전에 `toggle-all-classes`를 클릭해 확장하도록 테스트를 갱신하라. game-flow.spec.ts의 Mage 선택 테스트도 Mage가 추천 그룹에 있으므로 그대로 통과해야 한다(확인만).

## 작업 2 — 첫 세션 코치 (계획 Step 5)
- 새 저장(fresh save)에서만 4단계 가이드: ① 추천 클래스 하나 선택 ② 그 행동 요약 읽기 ③ Deploy Solo ④ 복귀 후 Training 열기.
- 각 단계에 Skip 버튼(data-testid `coach-skip`), 안내 패널은 data-testid `coach-panel`. **비차단 설계**: 패널은 셸 하단/모서리의 컴팩트 배너로, 다른 컨트롤 클릭을 막지 않는다(오버레이로 화면을 덮지 말 것). 단계 진행은 해당 행동 감지(클래스 선택, deploy 클릭, results 복귀, Training 탭 클릭)로 자동.
- 설정 영역(Auto-run·Sound 옆)에 Replay Tutorial 버튼(data-testid `coach-replay`).
- src/ui/save.ts에는 완료 여부와 현재 단계만 저장. 게임플레이를 코치 뒤에 잠그지 마라.
- **기존 테스트 파급 처리 (필수)**: 기존 game-flow/geometry/readability 테스트는 fresh context로 돈다 — 코치 배너가 떠 있어도 전부 통과해야 한다(비차단이면 통과함). 만약 특정 테스트가 배너와 겹쳐 깨지면 그 테스트에서 `coach-skip`을 먼저 클릭하는 보정은 허용.
- 신규 브라우저 테스트 test/browser/coach.spec.ts: ① fresh context에서 coach-panel 노출 + 4단계 완주(실행동으로) 후 사라짐 ② fresh context에서 Skip으로 종료 ③ localStorage에 완료 상태를 시딩한 returning context에서 coach-panel이 자동 재등장하지 않음 ④ coach-replay 클릭 시 재등장.

## 작업 3 — TestSprite 계획 갱신 (계획 Step 6)
- plans/guild-screen.json: 섹션 탭(guild-tab-class 등)을 먼저 내비게이트한 뒤 컨트롤과 상호작용하도록 단계 수정. 클래스 전체 확인 단계는 toggle-all-classes 확장을 포함. 11클래스 단언 유지.
- plans/trait-tuning.json: 퍼크/특성 관련 상호작용 전에 guild-tab-training 내비게이션 단계 추가.
- JSON 구조(TestSprite 포맷)는 유지, 마지막에 `node -e "JSON.parse(require('fs').readFileSync('plans/guild-screen.json','utf8'));JSON.parse(require('fs').readFileSync('plans/trait-tuning.json','utf8'))"` 로 파싱 확인.

## 작업 4 — 하우스키핑
- .gitignore에 `test-results/` 추가 (파일이 없으면 생성).

## 금지
- 기존 data-testid 이름 변경·삭제 금지. src/sim 수정 금지. title/run/results 화면 회귀 금지. 새 에셋 파일 금지. advisor-plans/ 수정 금지. git commit/push 금지.

## 완료 조건 (전부 만족할 때까지 반복)
1. `npm run typecheck` exit 0
2. `npm run test` 89개 전부 통과
3. `npm run test:ui` 전부 통과 (기존 전부 + coach.spec.ts, 3개 뷰포트)
4. plans JSON 2개 파싱 exit 0
5. 마지막에 `git diff --stat` 원문과 `git status --short` 원문을 보고에 포함

## 보고 형식 (한국어)
- 작업별 수행 내용 1~2줄
- 게이트 실제 출력 (테스트 개수, exit code)
- git diff --stat / git status --short 원문
