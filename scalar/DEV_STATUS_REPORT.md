# CRYSTAL / SCALA - PROJECT LATTICE 개발 진행상황 리포트

생성일시: 2026-01-11
프로젝트: scalar (h7 repository)
엔진: Phaser 3 + TypeScript + Vite + yarn + Vitest

---

## 1) 현재 구현 상태 (요약)

### 씬(Scene) 목록과 구현 수준

| 씬 이름 | 파일 경로 | 구현 수준 | 설명 |
|---------|----------|----------|------|
| **BootScene** | `src/scenes/BootScene.ts` | ✅ **완료** | 초기화 전용, Splash로 전환만 수행 |
| **SplashScene** | `src/scenes/SplashScene.ts` | ✅ **완료** | "CRYSTAL / SCALA" 타이틀 표시, 키/클릭 대기 후 Menu로 진입 |
| **MenuScene** | `src/scenes/MenuScene.ts` | ✅ **완료** | 마일스톤(M0~M6) 선택, Continue/Options/Save Slots 기능 모두 구현됨 |
| **GameScene** | `src/scenes/GameScene.ts` | ✅ **완료** | 메인 게임플레이, 노드 그래프 + 드론 이동 + Extract/Story/Hazard/Combat 모두 작동 |

**전체 씬 평가**: 4개 씬 모두 **완료**. 기본 게임 루프와 UI는 정상 작동 중.

---

### 핵심 게임 루프 (Planning / Execution / Debrief)

**현재 상태**: **부분 구현** (Planning + Execution은 작동, Debrief는 명시적 씬 없음)

- **Planning 모드**: `GameScene`에서 노드 선택 + 사이드패널 정보 표시 ✅
- **Execution 모드**: Move/Extract/Story/Hazard 액션 실행 시 즉시 결과 반영 ✅
- **Debrief 단계**: 별도 씬 없이 로그(Log)로만 표시됨 ⚠️ (추정: 나중에 추가 예정)

**추정 근거**: `types.ts`에 `RunMode = 'Planning' | 'Execution'` 정의됨. 그러나 실제 게임에서는 액션 후 즉시 상태 반영하며, 별도 "Debrief" 단계를 거치지 않음. 로그와 HUD 업데이트로 대체 중.

---

### 노드/엣지 데이터 정의 위치 및 구조

**파일**: `src/core/data.ts` (라인 43~240)

**노드 구조** (`NodeDef`):
```
- id: NodeId (string, 예: 'N0_HOME', 'N5_PART_A')
- name: 표시명 (예: 'Home Relay', 'Module Part A: Lattice Coupler')
- type: NodeType = 'Extract' | 'Story' | 'Hazard' | 'Combat'
- pos: { x, y } (그래프 좌표)
- risk: number (난이도/위험도 0~3)
- extract?: { baseChance, heatGain, reward: { power?, supplies?, parts?, endingPart? } }
- story?: { lines: [{ speaker, text }], once?: boolean }
- hazard?: { key, severity }
- combat?: { key, difficulty }
```

**엣지 구조** (`EdgeDef`):
```
- from: NodeId
- to: NodeId
- cost: { time, heat, power }
- requires?: { trustAtLeast?, hasItem? } (현재 미사용 추정)
```

**현재 노드 개수**: **11개** (N0~N11)
- Extract 노드 5개 (Substation, Depot, Scrapyard, Part A/B/C)
- Story 노드 4개 (Home Relay, Tape 01, Control Log, Friend Protocol)
- Hazard 노드 2개 (Patrol Sweep, Surgical Light)
- Combat 노드 1개 (Warden Skirmish)

**현재 엣지 개수**: **15개** (대부분 일방향, 일부 양방향)

**데이터 접근**: `data.nodes`, `data.edges` 배열로 export됨. `GameScene`에서 `nodeIndex: Map<NodeId, NodeDef>` 생성해 빠른 검색 지원.

---

### UI/HUD 상태

**HUD 컴포넌트** (`src/ui/hud.ts`):
- `createHudPlaceholder`: 상단 반투명 바 (Day/Heat/Power/Supplies/Parts/Scala Vitals/Stress/Trust/Drone Integrity 표시)
- `createPanel`: 재사용 가능한 패널 컨테이너
- `createTextButton`: 버튼 UI (hover, disable 지원)

**GameScene UI 요소**:
- **상단 HUD**: 12라인 텍스트로 모든 주요 상태 표시 (Day, Heat, 자원 3종, Scala 상태 3종, Drone 상태)
- **로그 패널**: 하단 좌측, 최근 6개 로그 라인 표시 (speaker: text 형식)
- **사이드 패널** (우측):
  - 타이틀: 선택한 노드 이름
  - 본문: 노드 타입, Risk, 보상/비용 정보
  - 버튼 4개: Move, Extract, Read, Resolve Hazard/Salvage Drone
  - 버튼 상태: 조건 충족 시만 활성화 (예: 이미 Extract한 노드는 비활성)
- **그리드**: 배경에 32px 격자 표시
- **노드 마커**: 원형, 타입별 색상 구분 (Extract=주황, Story=샌드, Hazard=붉은주황, Combat=분홍)
- **엣지**: 회색 선으로 연결, 선택 시 주황색 강조
- **드론**: 주황색 원, 선택 링 표시
- **스캔라인**: M5+ 옵션으로 활성화 가능 (화면 전체)

**MenuScene UI 요소**:
- 마일스톤 선택 버튼 (M0~M6)
- Continue / Options / Load Slot 1/2/3
- Details 패널 (선택한 마일스톤 설명)
- Options 오버레이: Scanlines, Camera Shake, Volume 토글

**평가**: UI/HUD는 **완료**. 모든 게임 정보 표시되며, 버튼 인터랙션 정상 작동.

---

## 2) 남은 TODO (우선순위 순)

### 반드시 구현해야 할 항목

1. **Debrief 단계 명시적 구현** (우선순위: 중)
   - 현재: 액션 후 즉시 상태 반영, 로그로만 피드백
   - 필요: 별도 Debrief 씬 또는 패널 추가 (Day 종료 시 요약 표시)
   - 작업 단계:
     1. `RunMode`에 `'Debrief'` 추가
     2. `GameScene`에 Debrief UI 패널 생성 (또는 별도 씬)
     3. Day 종료 시 Debrief 진입 로직 추가
     4. "Next Day" 버튼으로 Planning 복귀

2. **WARDEN 방송 시스템** (우선순위: 높음)
   - 현재: Story 노드에 WARDEN 대사 일부 있으나, 랜덤 방송 없음
   - 필요: Heat 임계치 도달 시 WARDEN 경고/압박 메시지 자동 출력
   - 작업 단계:
     1. `data.ts`에 WARDEN 방송 풀(pool) 추가
     2. `sim.ts`에 `triggerWardenBroadcast` 함수 추가 (Heat 기반)
     3. `GameScene`에서 Heat 변화 시 방송 체크 및 로그 추가

3. **드론 역할(Scout/Mule/Hack) 차별화** (우선순위: 중)
   - 현재: `DroneState.role` 필드 존재하나 실제 게임플레이에 영향 없음
   - 필요: 역할별 능력치/제약 적용
   - 작업 단계:
     1. `sim.ts`에 역할별 보너스/패널티 로직 추가 (예: Scout는 Hazard 회피 +10%, Mule는 적재량 +1)
     2. `GameScene`에 드론 역할 전환 UI 추가 (Home에서만 가능?)
     3. 역할별 아이콘/색상 구분

4. **아이템 시스템 (Tape, ModulePart)** (우선순위: 중)
   - 현재: `data.ts`에 `item?: 'Tape' | 'ModulePart'` 필드 정의됨, `EdgeDef.requires.hasItem` 존재하나 미사용
   - 필요: 특정 노드 해금에 아이템 필요 조건 적용
   - 작업 단계:
     1. `InventoryState`에 `items: string[]` 추가
     2. Extract 보상에 아이템 획득 로직 추가
     3. Move 시 `edge.requires.hasItem` 검증 로직 활성화
     4. UI에 아이템 목록 표시

5. **Trust 메카닉 강화** (우선순위: 중)
   - 현재: Trust 값 존재하나 게임플레이 영향 제한적 (Extract 성공률 +10% at Trust ≥60)
   - 필요: Trust ≥60 시 "Friend Protocol" 트리거 (경고 메시지 선행 표시)
   - 작업 단계:
     1. `sim.ts`에 Trust 기반 이벤트 트리거 추가
     2. Stress/Vitals 급변 예측 시 CRYSTAL 경고 로그
     3. Trust 하락 시 패널티 (예: Scala 반응 속도 저하)

---

### 있으면 좋은 항목

6. **Patrol/Lockdown 시각화** (우선순위: 낮음)
   - 현재: Heat ≥40 시 Lockdown 발동, 로그로만 표시
   - 필요: 그래프에 위험 구역 하이라이트 또는 애니메이션
   - 작업 단계:
     1. `GameScene`에 Heat 기반 위험 구역 오버레이 추가
     2. Lockdown 발동 시 화면 플래시 효과

7. **스토리 분기 (Milestone 기반)** (우선순위: 낮음)
   - 현재: 모든 Story 노드 고정 콘텐츠
   - 필요: Milestone 진행도에 따라 다른 Story 라인 표시
   - 작업 단계:
     1. `NodeDef.story.lines`를 함수로 변경 (state 기반 동적 생성)
     2. 조건부 스토리 노드 추가

8. **사운드/음악** (우선순위: 낮음)
   - 현재: Phaser Game에 사운드 시스템 미사용
   - 필요: BGM, UI 효과음, 긴장감 연출
   - 작업 단계:
     1. 사운드 파일 추가 (`public/assets/audio/`)
     2. `BootScene`에서 Preload
     3. `GameScene`에서 Heat/Action 시 재생

9. **세이브 파일 버전 호환성** (우선순위: 낮음)
   - 현재: `save.ts`에 간단한 타입 체크만 존재
   - 필요: 구조 변경 시 마이그레이션 로직
   - 작업 단계:
     1. 세이브 데이터에 `version` 필드 추가
     2. 로드 시 버전별 변환 함수 호출

10. **다국어 지원** (우선순위: 낮음)
    - 현재: 모든 텍스트 하드코딩 (영어/일부 한국어)
    - 필요: 언어 전환 시스템
    - 작업 단계:
      1. `i18n.ts` 생성, 언어별 JSON 파일
      2. Settings에 `language` 필드 추가
      3. 모든 텍스트를 `t('key')` 형태로 교체

---

## 3) 버그/리스크 (가장 큰 5개)

### 1. **상태 동기화 문제** (심각도: 중)
**설명**: `GameScene.update()`에서 `this.state !== this.lastStateRef` 비교로 상태 변경 감지. 그러나 불변 업데이트를 깜빡하면 UI 미반영 가능.
**위치**: `src/scenes/GameScene.ts:207-224`
**영향**: HUD가 최신 상태 미표시, 플레이어 혼란
**재현**: 상태 업데이트 시 spread 연산자 누락 (예: `state.heat = 50` 대신 `{ ...state, heat: 50 }`)
**해결 방안**: 
1. TypeScript `readonly` 키워드로 직접 수정 방지
2. 모든 상태 업데이트를 `applyXXX` 헬퍼 함수로 통합

---

### 2. **씬 전환 시 데이터 소실** (심각도: 중)
**설명**: `scene.start()`는 이전 씬 데이터를 자동 파기. `init(data)` 파라미터로 전달해야 하나, 일부 경로에서 누락 가능.
**위치**: `src/scenes/GameScene.ts:64-74`, `src/scenes/MenuScene.ts:144-158`
**영향**: Continue/Load 후 게임 상태 초기화되거나 크래시
**재현**: Menu → Game 전환 시 `loadState` 미전달
**해결 방안**:
1. 모든 `scene.start()` 호출 검토, 필수 데이터 전달 확인
2. `init()` 내 fallback 로직 강화 (이미 부분 구현됨)

---

### 3. **세이브 호환성 깨짐** (심각도: 중)
**설명**: `GameState` 구조 변경 시 기존 세이브 파일 로드 실패 가능.
**위치**: `src/core/save.ts:18-58`
**영향**: 플레이어 진행도 손실
**재현**: `GameState`에 새 필드 추가 → 기존 세이브 로드 시 `undefined`
**해결 방안**:
1. 세이브 데이터에 `schemaVersion` 필드 추가
2. 로드 시 마이그레이션 함수 체인 실행
3. 테스트에 세이브 로드 검증 추가

---

### 4. **테스트 부재 (UI/씬)** (심각도: 낮음)
**설명**: `tests/sim.test.ts`는 core 로직만 커버. 씬/UI/통합 테스트 없음.
**위치**: `tests/` 디렉토리 (통합 테스트 파일 부재)
**영향**: 씬 전환, 버튼 클릭, 상태 동기화 버그 미발견
**해결 방안**:
1. Vitest + jsdom으로 Phaser 씬 테스트 환경 구축 (또는 E2E with Playwright)
2. `GameScene.onClickMove()` 등 액션 함수 단위 테스트 추가

---

### 5. **LocalStorage 용량 초과** (심각도: 낮음)
**설명**: 로그(`log: LogLine[]`)가 200줄로 제한되나, 장기 플레이 시 세이브 데이터 커짐.
**위치**: `src/core/sim.ts:74-79` (로그 제한), `src/core/save.ts:14-15` (저장)
**영향**: LocalStorage 용량 초과 시 세이브 실패 (브라우저별 5-10MB 제한)
**재현**: 수백 일 플레이 + 여러 슬롯 세이브
**해결 방안**:
1. 로그를 세이브에서 제외 (플레이어는 최근 로그만 필요)
2. 또는 IndexedDB로 전환 (대용량 지원)

---

## 4) 스토리/콘텐츠 구체화 현황

### 스토리 비트/로그/WARDEN 방송

**Story 노드 (4개)**:
- `N0_HOME`: "Boot sequence clean..." CRYSTAL + SCALA + SYSTEM 대화 (Day 1 목표 제시) ✅
- `N4_TAPE01`: "Recovered: ANALOG TAPE..." 과거 실험 암시 ✅
- `N8_CONTROL_LOG`: "CONTROL LOG: override accepted..." 내부자 음모 암시 ✅
- `N11_FRIEND_PROTOCOL`: "We had a word for it..." CRYSTAL-SCALA 관계 심화 ✅

**WARDEN 존재**:
- `data.ts`에 `speaker: 'WARDEN'` 사용 예시 없음 ⚠️
- `types.ts`와 `state.ts`에 `LogLine.speaker`로 정의됨 (예: 'CRYSTAL' | 'SCALA' | 'WARDEN' | 'SYSTEM')
- **추정**: WARDEN 방송은 미구현. 향후 Heat 트리거 이벤트로 추가 예정.

**현재 스토리 깊이**:
- 기초 설정(AI 드론 원격 조종, Scala 트라우마/신체 약함) Story에 반영됨 ✅
- 악역 "얼굴 없는 시스템"의 목소리 WARDEN은 **미등장** ⚠️
- 과거 실험(LATTICE, 내부자)에 대한 단서는 Tape/Control Log에 존재 ✅
- Scala-Crystal 관계 발전("Friend Protocol")도 일부 표현됨 ✅

**평가**: 스토리 뼈대 완성, 핵심 테마 표현됨. 그러나 **WARDEN 방송 부재**로 긴장감 부족. 더 많은 Story 노드와 동적 이벤트 필요.

---

### Part A/B/C와 연계된 노드/이벤트

**Module Part 노드 (3개)**:
- `N5_PART_A`: "Module Part A: Lattice Coupler" (Extract, Risk 3, baseChance 0.6, Heat +14) ✅
- `N9_PART_B`: "Module Part B: Phase Gate" (Extract, Risk 3, baseChance 0.55, Heat +16) ✅
- `N10_PART_C`: "Module Part C: Null Latch" (Extract, Risk 3, baseChance 0.5, Heat +18) ✅

**연계 조건**:
- Part A는 N4_TAPE01 이후 접근 가능 (엣지 존재) ✅
- Part B는 Part A 획득 후 접근 (엣지: N5 → N9, cost 높음) ✅
- Part C는 Combat 노드(N7B) 통과 후 접근 가능 ✅

**승리 조건**:
- `sim.ts:86-89`: `isWin(state)` - Part A/B/C 모두 `true`일 때 승리 ✅
- `GameScene.ts:756-782`: 엔딩 오버레이 표시 ("ENDING: LATTICE LINK COMPLETE") ✅

**실패 조건**:
- `sim.ts:91-95`: Heat ≥100 또는 Vitals ≤0 ✅
- 엔딩 오버레이에 실패 사유 표시 ("FAILED: Heat100" / "FAILED: Vitals0") ✅

**평가**: 승리/실패 조건 **완전 구현**. Part A/B/C 획득 루트도 논리적으로 연결됨. 단, 엔딩 후 스토리 epilogue 없음 (단순 "Press M/R" 메시지만).

---

## 5) 다음 커밋 제안 (3개)

### 커밋 1: WARDEN 방송 시스템 추가
**타이틀**: `feat(scalar): add WARDEN broadcast system triggered by Heat thresholds`

**포함 파일**:
- `src/core/data.ts` (WARDEN 방송 풀 추가)
- `src/core/sim.ts` (`triggerWardenBroadcast` 함수 추가)
- `src/scenes/GameScene.ts` (Heat 변화 시 방송 체크 로직)

**변경 요약**:
1. `data.ts`에 `wardenBroadcasts: { heatThreshold, text }[]` 배열 추가 (예: Heat 40/60/80/100 시 다른 메시지)
2. `sim.ts`에 `selectWardenBroadcast(heat)` 함수 추가 (임계치 초과 시 랜덤 선택)
3. `GameScene.onClickMove/Extract/Hazard` 내에서 Heat 증가 시 `appendLog(state, { speaker: 'WARDEN', text: ... })` 호출

---

### 커밋 2: 드론 역할 차별화 및 전환 UI
**타이틀**: `feat(scalar): implement drone role (Scout/Mule/Hack) gameplay differentiation`

**포함 파일**:
- `src/core/sim.ts` (역할별 보너스 로직)
- `src/scenes/GameScene.ts` (Home 노드에서 역할 전환 버튼 추가)
- `src/ui/hud.ts` (역할 표시 아이콘 헬퍼 함수)

**변경 요약**:
1. `sim.ts`에 `getDroneRoleBonus(role, actionType)` 함수 추가 (예: Scout는 Hazard 회피 +10%, Mule는 Extract 적재량 +1)
2. `GameScene` 사이드 패널에 "Change Role" 버튼 추가 (Home 노드에서만 활성)
3. HUD에 드론 역할 아이콘 표시 (예: Scout="👁️", Mule="📦", Hack="🔧")

---

### 커밋 3: Debrief 단계 명시적 구현 및 Day 요약
**타이틀**: `feat(scalar): add explicit Debrief phase with day summary UI`

**포함 파일**:
- `src/types.ts` (`RunMode`에 `'Debrief'` 추가)
- `src/scenes/GameScene.ts` (Debrief UI 패널 + "Next Day" 버튼)
- `src/core/sim.ts` (`applyDayEnd` 함수 추가 - 일일 이벤트 처리)

**변경 요약**:
1. `RunMode`를 `'Planning' | 'Execution' | 'Debrief'`로 확장
2. `GameScene`에 Debrief 패널 생성 (중앙 오버레이): Day 변화, 획득 자원, Heat 증가, Scala 상태 요약 표시
3. "Next Day" 버튼 클릭 시 `state.run.mode = 'Planning'`으로 전환 + 드론을 Home으로 귀환 (옵션)

---

## 추가 참고 사항

### 파일 구조 요약
```
scalar/
├── src/
│   ├── main.ts (Phaser Game 초기화)
│   ├── theme.ts (색상/폰트 상수)
│   ├── types.ts (공용 타입)
│   ├── core/
│   │   ├── data.ts (노드/엣지 데이터)
│   │   ├── state.ts (GameState 정의 + 초기화)
│   │   ├── sim.ts (게임 로직 - Extract/Hazard/Combat/Move 시뮬레이션)
│   │   ├── save.ts (LocalStorage 세이브/로드)
│   │   └── rng.ts (결정적 난수 생성기)
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── SplashScene.ts
│   │   ├── MenuScene.ts
│   │   └── GameScene.ts (메인 게임플레이)
│   └── ui/
│       └── hud.ts (UI 컴포넌트 헬퍼)
├── tests/
│   └── sim.test.ts (core 로직 단위 테스트 9개, 모두 통과)
├── package.json (yarn 4.12.0, Phaser 3.90.0, Vitest 4.0.16)
└── vite.config.ts (빌드 설정)
```

### 기술 스택 버전
- **Phaser**: 3.90.0
- **TypeScript**: 5.9.3
- **Vite**: 7.3.1
- **Vitest**: 4.0.16
- **yarn**: 4.12.0 (Corepack via package.json)

### 테스트 현황
- **단위 테스트**: `tests/sim.test.ts` (9개 테스트, 모두 통과 ✅)
- **통합/E2E 테스트**: 없음 ⚠️
- **커버리지**: core 로직(sim.ts, state.ts, rng.ts)만 커버, 씬/UI 미커버

### 알려진 제약
- 전투 시스템(Combat) 존재하나 "전투 없음" 컨셉과 상충 가능 (추정: 회피 가능한 위험 요소로 재해석 필요)
- 노드 그래프가 고정됨 (동적 생성/변화 없음)
- 음악/효과음 미구현
- 다국어 미지원 (UI는 영어, Story는 영어+일부 한국어 혼재)

---

**작성자 노트**: 이 리포트는 코드베이스 전체 검토 후 작성됨. 추정 항목은 파일 경로와 근거를 명시. 확실하지 않은 부분은 "추정", "미확인" 표시.
