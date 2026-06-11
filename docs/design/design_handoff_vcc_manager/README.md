# Handoff: VCC Manager Design System v1

## Overview

VCC Manager는 ComfyUI / OpenAI / Gemini 백엔드 위에 이미지·텍스트·영상 생성 워크플로우를 관리하는 사내 도구입니다. 이 패키지는 디자인 시스템(토큰 + 컴포넌트) + 10개 핵심 페이지의 high-fidelity HTML mockup + clickable prototype + 8단계 PR 마이그레이션 가이드를 포함합니다.

대상 코드베이스: **React 18 + Material-UI v5 + React Query + react-hook-form**. 한국어 UI 우선. 라이트 단일 → 다크모드 옵트인.

## About the Design Files

`prototypes/` 폴더의 파일들은 **디자인 레퍼런스**입니다. 브라우저에서 바로 열어 보고, 인터랙션을 확인하고, DOM을 검사해 정확한 값을 추출하는 용도입니다. **그대로 코드베이스에 복사해 쓰는 것이 아니라**, 기존 React + MUI 환경에 맞춰 동일한 디자인을 재구현하는 것이 목표입니다.

가장 중요한 산출물은:
1. **`theme.ts`** — MUI `ThemeOptions` 객체. `createTheme(vccTheme)`로 즉시 적용 가능. (단일 진입점)
2. **`tokens.css`** — 모든 디자인 토큰을 CSS variables로. light + dark 두 모드 포함. MUI 외부 영역에서도 사용 가능 (예: 커스텀 CSS-in-JS, 비-MUI 컴포넌트).
3. **`prototypes/VCC Manager Migration Guide.html`** — 현재 코드 → 새 디자인 8단계 PR 분해. 단계별 before/after 코드 스니펫. **이 문서를 먼저 읽으세요.**

## Deviations from v1 (코드 측 확정 변경 — 목업보다 이 섹션이 우선)

구현 과정에서 의도적으로 디자인과 다르게 결정된 항목들. **이 패키지의 목업/스크린샷과 코드가 다를 때, 아래 항목은 코드가 정답이다.** 새 항목은 결정이 내려진 PR 에서 함께 추가할 것.

| 항목 | v1 디자인 | 확정 동작 | 근거 |
|---|---|---|---|
| 사이드바/헤더 (라이트 모드) | 다크 네이비 고정 | **라이트 모드에선 밝은 navbar** (흰 표면 + 옅은 primary 틴트), 다크 모드에서만 네이비 | #514, 2026-06-12 사용자 확정 |
| 관리자 메뉴 구분 | (디자인에 별도 명시 없음) | 중립 색상 + overline 섹션 라벨 "관리자 메뉴" 로 구분 (빨강 일괄 적용 폐지) | #542, 2026-06-12 |
| 작업 히스토리 상단 필터 | 프로젝트 / 기간 필터 버튼 | **프로젝트 필터 도입 안 함** (프로젝트 화면이 별도 존재). 기간 필터는 추후 후보 | 2026-06-12 사용자 확정 |
| 작업판 카탈로그 카드 | 즐겨찾기 별 | **출력 type 칩 추가** (image/text/video) — 라이브 추가 요소 유지 | #463 계열 |
| MuiPaper `defaultProps variant:'outlined'` | 테마 일괄 적용 | **페이지 리디자인 시 점진 적용** (legacy 페이지 일괄 변경 회피) | 2026-06-12 사용자 확정 |
| 서버 타입 색 | (토큰 외) | `templates/capabilities.js` 의 **브랜드 컬러 유지** (OpenAI teal `#10a37f`, Google blue `#4285f4` 등 — 의도된 토큰 외 예외) | 주석 명시 |
| 폰트 로딩 | 자체 호스팅 권장 | 현재 CDN (jsdelivr + Google Fonts) — 자체 호스팅 전환은 추후 | - |
| 대시보드 통계 블록 | v1 포함 → v1.1 제거 | v1.1 기준 (제거) — `11-dark-dashboard.png` 의 통계 블록은 구버전 | v1.1 |

## Fidelity

**High-fidelity.** 모든 컬러, 타이포, 간격, radius, shadow가 final 값입니다. 픽셀 단위로 재현해 주세요.

- 인터랙션과 애니메이션도 명시되어 있습니다 (`@keyframes`, transition duration 등).
- 한국어 라벨, 시드/ID 같은 모노스페이스 영역, 한국어 letter-spacing(-0.005em) / text-wrap: pretty 정책 포함.
- 데이터·이미지는 placeholder입니다 (스트라이프 패턴 `.thumb-tile`). 실제 API 응답 형태는 [source/BRIEF.md](source/BRIEF.md) 참고.

## Recommended Implementation Order

마이그레이션 가이드(`prototypes/VCC Manager Migration Guide.html`)의 8단계를 그대로 따라가세요. 요약:

| Phase | 작업 | 작업량 | 영향 |
|---|---|---|---|
| 0 | Pretendard + JetBrains Mono 폰트 로딩 | 30분 | 없음 (fallback 유지) |
| 1 | `theme.ts`를 `vccTheme`로 교체 | 1일 | 핵심 컬러·radius·shadow 일괄 교체 |
| 2 | 사이드바 hex 6종 → `palette.navbar` | 4시간 | hardcode 제거 |
| 3 | `size="small"` props 일괄 제거 (codemod) | 3시간 | 312곳 코드 축소 |
| 4 | 한국어 letter-spacing + text-wrap | 2시간 | 가독성 |
| 5 | 핵심 페이지 mockup 적용 (5a~5e, 화면당 별도 PR) | 1주 | 시각적 큰 변화 |
| 6 | ⌘K 명령 팔레트 + 알림 popover | 3일 | 신규 기능 |
| 7 | 다크모드 (옵트인) | 2일 | 사용자 설정 추가 |

## Screenshots — 빠른 참조

각 페이지의 최종 모습은 `screenshots/` 폴더의 PNG에서 확인할 수 있습니다. 구현 시 다음과 같이 매칭:

### Desktop

| 스크린샷 | 구현 대상 페이지 | 소스 파일 |
|---|---|---|
| `01-dashboard.png` | E. 대시보드 (로그인 후 첫 화면 · v1.1 통계 블록 제거) | `prototypes/page-dashboard.jsx` |
| `28-work-history.png` · `29-work-history-video.png` · `30-work-history-text.png` | N. 작업 히스토리 (통합 피드 · 세그먼트 · 계속하기/다른 작업) | `prototypes/page-history.jsx` |
| `02-project-detail.png` | A. 프로젝트 상세 (탭 구조) | `prototypes/page-project-detail.jsx` |
| `03-pipeline-builder.png` | B. 파이프라인 빌더 lane (novel) | `prototypes/page-pipeline-builder.jsx` |
| `04-pipeline-run.png` | C. 파이프라인 실행 + 히스토리 | `prototypes/page-pipeline-run.jsx` |
| `05-content-library.png` / `27-content-library.png` | D. 내 컨텐츠 | `prototypes/page-content-library.jsx` |
| `06-workboard-run.png` | F. 작업판 단발 실행 | `prototypes/page-workboard-run.jsx` |
| `07-workboard-editor.png` | G. 작업판 정의 admin (3-pane) | `prototypes/page-workboard-editor.jsx` |
| `08-admin-servers.png` | H. 서버 관리 admin | `prototypes/page-admin-servers.jsx` |
| `16-admin-users.png` | I. 사용자/그룹 admin | `prototypes/page-admin-users.jsx` |
| `24-projects-list.png` | K. 프로젝트 카탈로그 (사이드바 → 프로젝트) | `prototypes/page-project-list.jsx` |
| `25-workboard-list.png` | L. 작업판 카탈로그 (2축 필터: 출력 × 서버) | `prototypes/page-workboard-list.jsx` + `prototypes/workboard-shared.jsx` |
| `26-document-editor.png` | M. 세계관 문서 에디터 (편집/분할/미리보기) | `prototypes/page-document-editor.jsx` |
| `09-command-palette.png` | ⌘K 명령 팔레트 (오버레이) | `prototypes/command-palette.jsx` |
| `10-notifications.png` | 벨 popover | `prototypes/notifications.jsx` |
| `11`–`13-dark-*.png` | 다크 모드 적용 예시 | `tokens.css` `[data-theme="dark"]` |
| `14`–`15-migration-guide-*.png` | 마이그레이션 가이드 비주얼 참조 | `prototypes/VCC Manager Migration Guide.html` |

> 이미지 라이트박스 (`image-lightbox.jsx`) 과 9대 빈 상태 패턴 (`empty-states.jsx`) 은 디자인 캐버스(섹션 13, 14)에서 직접 확인하세요.

### Mobile (390×844, iPhone 15)

| 스크린샷 | 화면 | 모바일 UX 핵심 |
|---|---|---|
| `17-mobile-dashboard.png` | 대시보드 | 위젯이 1열로 스택, 최근 이미지 그리드 3열 |
| `18-mobile-project-detail.png` | 프로젝트 상세 | 헤더 + 3 액션 버튼 행 |
| `19-mobile-project-detail-tabs.png` | 프로젝트 상세 (탭 영역) | **탭 → Iris 드롭다운 select** (가로 스크롤 없음) |
| `20-mobile-pipeline-builder.png` | 파이프라인 빌더 | **"탭하여 편집" pill** 명시, drag 핸들 제거, 카드 세로 스택 |
| `21-mobile-pipeline-run.png` | 파이프라인 실행 | Stepper 수직, 결과 카드 인라인 |
| `22-mobile-content-library.png` | 내 컨텐츠 | 탭 드롭다운 + 2열 그리드, 필터 레일 숨김 |
| `23-mobile-workboard-run.png` | 작업판 실행 | 폼이 1열 스택, 우측 panel은 form 하단으로 이동 |

> 픽셀 단위 정확도가 필요할 때는 `prototypes/Prototype.html`을 브라우저에 띄우고 devtools로 직접 측정하세요 — 모든 spacing/font-size가 inline style에 명시되어 있습니다.

## Design Tokens & System Docs

전체 토큰은 `tokens.css` (CSS variables) + `theme.ts` (MUI 객체) 두 형식으로 제공됩니다.

**시스템 문서**는 디자인 캔버스(`prototypes/VCC Manager Design.html`)의 다음 섹션에서 시각적으로 확인:
- 섹션 15 · **System Docs** — Grid system / Data Table / Form Patterns / Dropdowns & Popovers
- 섹션 14 · Empty States — 9가지 빈 상태 패턴
- 섹션 06 · Information States — Empty / Loading / Error / Toast

핵심:

전체 토큰은 `tokens.css` (CSS variables) + `theme.ts` (MUI 객체) 두 형식으로 제공됩니다. 핵심:

### Colors

```
accent (Iris — 단일 브랜드 컬러):
  9 (primary):  #5B5BD6   ← MUI primary.main 교체
  10 (hover):   #4F4FC9
  11 (text):    #4040AD
  3 (subtle bg): #ECECFE

background:
  default: #F7F7F4 (warm-neutral, was #FFFFFF)
  paper:   #FFFFFF
  subtle:  #F1F1ED
  
text:
  primary:   #16181D
  secondary: #5B616E
  tertiary:  #8A8F9A
  disabled:  #B6BAC2

navbar (NEW palette — 기존 #2c3e50/#34495e/#ecf0f1/#bdc3c7 통합):
  main:         #161A22
  light:        #262C39 (active)
  dark:         #0F1218
  contrastText: #E4E5E9
  
status:
  success: #1F9D55 / bg #DCF4E5
  warning: #BE7415 / bg #FAEBC8
  danger:  #D5383E / bg #FBE0E0
  info:    #2F77E4 / bg #DCEBFC

tag (built-in tags):
  world:   #7B4DD8
  system:  #2F77E4
  project: #5B5BD6
```

### Typography

```
font-sans: "Pretendard Variable", -apple-system, "Noto Sans KR", Roboto, sans-serif
font-mono: "JetBrains Mono", "SF Mono", Menlo, monospace

Scale:
  display: 28/36, 700
  h1:      22/30, 700
  h2:      18/26, 700
  h3:      15/22, 600
  body:    14/22, 400
  small:   13/20, 400
  tiny:    12/18, 500
  micro:   11/16, 500 (uppercase, letter-spacing 0.06em)

한국어 본문: letter-spacing -0.005em, text-wrap: pretty
mono 사용처: ID, 시드, 파일명, 메타데이터, 토큰 카운트, 시간/날짜
```

### Spacing & Radius

```
spacing: 4-based (4/8/12/16/20/24/32/40/48/64)
MUI base: theme.spacing(2) = 8px  (theme.spacing: 4)

radius:
  r-1: 4px (chips)
  r-2: 6px (default — buttons, inputs)
  r-3: 8px (cards)
  r-4: 12px (large surfaces)
  r-5: 16px (hero / sheets)
  pill: 999px
```

### Shadows

```
shadow-1: 0 1px 2px rgba(15,18,28,0.05), 0 0 0 1px rgba(15,18,28,0.04)
shadow-2: 0 2px 6px rgba(15,18,28,0.07), 0 1px 2px rgba(15,18,28,0.04)
shadow-3: 0 8px 24px rgba(15,18,28,0.10), 0 2px 6px rgba(15,18,28,0.06)
shadow-4: 0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)
focus:    0 0 0 3px rgba(91,91,214,0.20)
```

### Component defaultProps

```
MuiButton: { size: 'small', disableElevation: true }
MuiChip:   { size: 'small', variant: 'outlined' }
MuiPaper:  { variant: 'outlined' }
MuiTextField: { size: 'small', variant: 'outlined' }
```

→ 매번 명시할 필요 없음. 기존 312개 `size="small"` props 일괄 제거 가능.

---

## Screens / Views

9개 페이지 전부 데스크탑(1440) + 모바일(390) 두 변형이 mockup에 있습니다. `prototypes/Prototype.html`을 열어 우하단 도크에서 페이지 간 이동 + 우상단 Tweaks 패널에서 dark/sidebar/density/accent 토글 가능.

### A. 프로젝트 상세 (`page-project-detail.jsx`)
- **목적**: 한 프로젝트의 hub. 6 탭: 파이프라인 / 세계관 / 프롬프트 / 이미지 / 파이프라인 히스토리 / 대화 히스토리
- **레이아웃**: 좌측 헤더(프로젝트 아바타 그라데이션 + 제목 + 즐겨찾기 + 메타 chips) · 우측 액션 버튼 · 탭 row · 본문
- **핵심 디테일**: 36 그라데이션 아바타(`linear-gradient(135deg, #7B4DD8 0%, #5B5BD6 50%, #2F77E4 100%)`). 탭은 `scrollable + scrollButtons={false}` 모바일.

### B. 파이프라인 빌더 — Lane variant (novel) (`page-pipeline-builder.jsx`)
- **목적**: 작업판 A→B→C 직선 연결을 가로 흐름으로 시각화
- **레이아웃**: 좌측 컨텍스트 문서 팔레트(드래그 source) · 우측 가로 lane(타입 자동주입 가능 여부 표시 rail + 단계 카드 + 신규 단계 슬롯)
- **핵심 인터랙션**: 단계 카드 클릭 → 인라인 펼침(모달 없음). 카드 내부에 사전 입력 textarea / 문서 슬롯 / 메모 / 단독 실행.

### B-alt. 파이프라인 빌더 — List variant (`page-pipeline-builder.jsx` → `PipelineBuilderListPage`)
- 안전한 MUI Stepper 패턴. lane이 부담스러우면 옵션.

### B-alt2. 파이프라인 빌더 — Graph variant (`page-pipeline-builder-graph.jsx`)
- ComfyUI/n8n 스타일 자유 캔버스. SVG 베지에 커브, 타입 색상 코드(text=Iris/image=violet/video=amber). 캔버스는 가로 스크롤(1500px wide), chrome 4종은 절대 위치 고정.
- 분기·병합·여러 출력 지원하려면 이 variant 채택.

### C. 파이프라인 실행 + 히스토리 (`page-pipeline-run.jsx`)
- **목적**: 진행 중 vs 완료 두 상태
- **레이아웃**: 진행 바 → vertical Stepper(단계당 결과 카드 인라인, 텍스트는 caret blinking, 이미지는 4-grid)
- **우측 sticky rail**: 실행 정보 / 최근 실행 / 다음 작업으로 (이미지→영상, LoRA 학습 큐 등)
- **mode 토글 데모**: 실행 중 ↔ 완료 — 실제 구현 시 polling으로 자동 전환

### D. 내 컨텐츠 (`page-content-library.jsx`)
- **목적**: 생성·업로드 자산 라이브러리. 5 탭(생성된 이미지 / 업로드된 이미지 / 영상 / 직접 작성 텍스트 / 생성된 텍스트)
- **레이아웃**: 검색 row · 탭 · 좌측 필터 레일(프로젝트/태그/크기/기간 각 카운트) + 우측 그리드(데스크 5열 / 모바일 2열)
- **핵심**: 영상 16:9 + 재생 오버레이, 즐겨찾기 별, 페이지네이션, 그리드/목록 뷰 토글

### E. 대시보드 (`page-dashboard.jsx`)
- **목적**: 로그인 직후 첫 화면
- **위젯**: 인사 + 빠른 액션(새 프로젝트/작업판 실행/파이프라인 만들기/이미지 업로드) + 실행 중 파이프라인 + 최근 프로젝트 카드 + 최근 이미지 6/12장 + 주간 sparkline + 서버 상태 + 자주 쓰는 작업판 top4
- **변경(v1.1)**: 상단 통계 4블록(총 이미지/실행 시간/프로젝트/작업판)은 **제거됨**. 인사 + 빠른 액션 바로 아래에 2열 콘텐츠가 이어집니다.

### N. 작업 히스토리 (`page-history.jsx`)
- **목적**: 사이드바 "작업 히스토리" 진입점. 파이프라인 · 이미지 · 영상 · 텍스트 생성 기록을 **하나의 통합 피드**(최신순)로 표시
- **레이아웃**: 헤더(제목 + 프로젝트/기간 필터 버튼) · 검색 input · 세그먼트 컨트롤(`전체 / 파이프라인 / 이미지 / 영상 / 텍스트`, 각 카운트) · 카드 리스트
- **행(row)은 타입별로 적응**:
  - **이미지** — 썸네일(`.thumb-tile`, `--h` hue) + 장수 배지(`×4`), `프로젝트 · 모델 · 해상도 · N장`
  - **영상** — 썸네일 위 재생 오버레이 + 길이 배지(`4초`), `프로젝트 · 모델 · 해상도 · 길이`
  - **텍스트** — `Icon.Type` 타일 + 2줄 클램프 본문 미리보기(tinted box) + 토큰 수
  - **파이프라인** — `Icon.Pipe` 타일 + 단계 진행 dots(완료=success / 실패=danger / 대기=subtle) + 진행률 바
- **작업 재개 버튼 2종 (이미지·영상 행 한정, `status !== "error"`)**:
  - **계속하기** (`Icon.Refresh`) — 같은 작업을 **같은 설정으로 이어서** 진행 (동일 작업판·파라미터 재실행)
  - **다른 작업** (`Icon.ArrowRight`) — 이 결과를 **입력으로 다른 작업판으로 전환**
  - 두 버튼은 `e.stopPropagation()`으로 행 클릭(이미지 라이트박스 열기)과 분리
- **우측 메타**: 시간(mono) + 상세 링크(`상세 →` 파이프라인 / `전문 보기 →` 텍스트 / `열기 →` 이미지·영상)
- **상태 칩**: 완료(success) / 실행 중(info + pulse dot) / 실패(danger) / 대기(default)
- **백엔드 권장**: 타입별 엔티티를 `useQueries`로 동시 조회 후 시각(time) 기준 병합 정렬. 실행 중 항목은 polling.

> 참고: 프로젝트 상세(A)의 "파이프라인 히스토리" 탭은 **해당 프로젝트 범위**의 파이프라인 실행만 보여주는 별개 뷰입니다. 작업 히스토리(N)는 **전역·전 타입** 피드입니다.

### F. 작업판 단발 실행 (`page-workboard-run.jsx`) — 여정 B
- **목적**: 한 작업판을 양식 채워서 한 번 실행
- **레이아웃**: 좌측 폼(프롬프트 / LoRA chips / 시드 토글 / 고급 설정 — 단계 슬라이더 등) · 우측 sticky panel(작업판 정보 + 실행 버튼 + 미리보기 + 최근 결과)
- **시드 토글**: 무작위 ON시 input disabled + 흐림, OFF시 활성

### G. 작업판 정의 (admin, novel) (`page-workboard-editor.jsx`)
- **목적**: customField 디자이너 — admin이 사용자 양식을 정의
- **레이아웃**: 3-pane = 필드 타입 팔레트(좌) · 필드 리스트 + 인스펙터(중) · 라이브 프리뷰(우)
- **핵심**: 가운데 필드 선택 시 우측 프리뷰에서 해당 필드가 Iris 보더로 하이라이트. 모달 없이 인라인 편집.
- **필드 타입**: text / prompt / number / select / slider / image / model / lora / seed

### H. 서버 관리 (admin) (`page-admin-servers.jsx`)
- **목적**: ComfyUI / OpenAI / Gemini / Compatible 백엔드 등록 + 상태 모니터링
- **레이아웃**: 통계 3(서버/온라인/실행 중 큐) + 서버 카드 리스트
- **변경(v1.2)**: 설치된 모델 인라인 리스트 **제거**(모델 관리 영역 소관) · 상단 "총 모델" 통계 카드 **제거**(4→3칸) · 카드 비확장형
- **모바일(v1.2)**: 한 줄에 GPU·큐·동기화를 욱여넣던 레이아웃을 **세로 적층형**으로 교체 — ①배지+이름+타입 ②호스트 ③상태 칩 ⟷ 마지막 동기화 ④GPU 바(전체 폭)+큐
- **상태 표시**: online (success dot) / degraded (warning) / offline (danger), GPU 사용률 바, 큐 카운트, 마지막 동기화 시각

### O. 관리자 대시보드 (admin) (`page-admin-dashboard.jsx`)
- **목적**: 시스템 통계(분석/리포트)와 구분되는 **운영 허브** — "지금 무엇을 봐야 하나"
- **레이아웃**: 헤더(주의 필요 배지) · 헬스 스트립 4(서버/GPU 평균/대기 큐/활성 사용자) · 2열(조치 필요 + 최근 관리 활동) · 관리 영역 바로가기 카드 6
- **조치 필요**: 심각도(danger/warning/info)별 행 + 각 항목에서 해당 관리 페이지로 이동(`onNav(key)`)
- **관리 영역 카드**: 사용자/서버/모델/작업판/통계/백업 — 핵심 지표 + 클릭 시 이동
- **주의**: 시스템 통계(`page-admin-stats.jsx`)는 그대로 분석 화면. 사이드바 "관리자 대시보드"와 "시스템 통계"가 **별개 라우트**

### P. 작업판 관리 (admin) (`page-admin-workboards.jsx`)
- **목적**: 작업판 **정의/거버넌스** 목록. 사용자 카탈로그(L)와 카드·필터 레이아웃을 **공유**하되 관리 관점
- **공유 모듈**: `workboard-shared.jsx` — `WorkboardCard`(admin prop으로 분기) · `WorkboardFilters`(2축) · `useWorkboardFilter` 훅
- **사용자 목록(L)과의 차이**: 사용자=실행(생성/관리 불가, "새 작업판" 없음). 관리=상태 배지(게시됨/초안/보관) · 허용 그룹 칩 · 편집/더보기 · 새 작업판 · 상태 필터 한 줄 추가
- **편집 진입**: 카드 "편집" → `page-workboard-editor.jsx`(G). 편집기의 "← 작업판 관리" / 저장 / 취소 → 목록 복귀
- **2축 필터(공유)**: **출력 형식**(이미지/영상/텍스트/LoRA) × **서버 타입**(ComfyUI/OpenAI/Gemini), 각 다중선택 + 카운트 + 검색 + 초기화. 단일 탭 필터 대체

### Q. 다른 작업 전환 picker (`workboard-picker.jsx`)
- **목적**: 작업 히스토리(N)·라이트박스에서 이미지/영상 결과를 **입력으로** 다른 작업판에 흘려보내는 전환 모달
- **핵심**: 단순 나열 아님 — 소스 미리보기 + 카드별 "이미지 → 영상" 입출력 흐름 명시 + **입력 타입 호환** 작업판만 필터
- **구성**: 추천(피처드, 가장 흔한 다음 단계) + 출력 종류별 그룹(영상 생성/이미지 변환/LoRA 학습) + 검색. Esc/배경 클릭 닫기

### I. 사용자 / 그룹 관리 (admin) (`page-admin-users.jsx`)
- **목적**: 계정/그룹 멤버십/초대
- **레이아웃**: 4 탭(사용자/그룹/초대/감사 로그). 사용자 탭은 좌측 그룹 필터 레일 + 우측 테이블
- **반응형**: container query로 카드 폭 < 720px일 때 우측 3컬럼 자동 숨김

### J. 인증 (`page-auth.jsx`)
- 풀-블리드, 사이드바 없음
- 좌측 480px Iris 그라데이션 aside (브랜드 + 태그라인 + dot-grid + 서버 상태 ping) + 우측 폼
- 로그인 / 가입 요청 두 변형

---

## Global UX

### ⌘K 명령 팔레트 (`command-palette.jsx`)
- 전역 Cmd/Ctrl+K로 열림
- 5 결과 그룹: 프로젝트 / 작업판 / 파이프라인 / 문서 / 명령
- ↑/↓ 키보드 nav, Enter 선택, Esc 닫기
- 실시간 필터링, 단축키 표시(⌘N, ⌘U 등)
- 백엔드: `useQueries`로 프로젝트/작업판/파이프라인 동시 조회 권장

### 알림 popover (`notifications.jsx`)
- 벨 아이콘 클릭 시 popover (anchorRect 기준 동적 위치)
- 새 알림 / 이전 두 그룹
- 토널 컬러 (success/warning/info/danger) + 액션 링크
- 실시간 dot pulse (bell 위)

### Tweaks 패널 (개발용, 프로덕션 제외)
- 프로토타입에만 있는 디자인 비교 도구. 프로덕션 코드에는 포함시키지 마세요. dark / accent / density / sidebar tone / pipeline variant 토글 데모용.

---

## Interactions & Behavior

각 페이지 컴포넌트의 인라인 주석에 상세히 기재. 핵심 패턴:

- **모달은 마지막 수단**: 인라인 편집 우선 (파이프라인 빌더, 작업판 에디터 둘 다 모달 0개)
- **Sticky right rails**: 파이프라인 실행, 작업판 실행에서 우측 메타 패널이 sticky
- **Loading**: shimmer skeleton (`@keyframes shim`), spinner는 `Icon.Spinner className="spin"` 패턴
- **Empty states**: 점선 보더 + 중앙 아이콘 + CTA 패턴 (`prototypes/extras.jsx`의 `EmptyStateCard`)
- **Toast**: 좌측 컬러 바 + 닫기 버튼 (`extras.jsx`의 toast row)
- **Transitions**: 모두 `cubic-bezier(.2,.7,.3,1)` easing, `120ms`(hover) / `180ms`(expand) / `240ms`(layout) 3단 duration

---

## State Management

- 라이브 데이터(실행 중 파이프라인, 서버 상태)는 React Query로 polling 권장 (interval 2-5초)
- 명령 팔레트 검색은 `useQueries`로 다중 엔티티 동시 조회 + client-side 필터링 (현재 디자인 기준 결과 < 100개 가정)
- 다크모드 상태는 user preference로 저장 (localStorage 또는 backend user settings)
- Tweaks 패널 상태는 프로덕션 제외

---

## Assets

- 폰트: Pretendard Variable (CDN: jsdelivr) + JetBrains Mono (Google Fonts) — 자체 호스팅 권장
- 아이콘: 자체 SVG icon set (`prototypes/icons.jsx`) — 약 40개, 16×16 viewBox, stroke 1.5. **별도 아이콘 라이브러리(MUI Icons 등) 대신 이 set 채택 권장** — 일관된 스타일, 작은 번들 사이즈, 한 줄 props (`<Icon.Plus />`, `<Icon.Spinner className="spin"/>` 등)
- 이미지 placeholder: `.thumb-tile` CSS 클래스 + `--h` (hue) 커스텀 프로퍼티 — light/dark 자동 매핑

---

## Files in this package

```
design_handoff_vcc_manager/
├── README.md                       (this file)
├── theme.ts                        ★ MUI ThemeOptions — Phase 1에서 즉시 적용
├── tokens.css                      CSS variables (light + dark) — MUI 외부 사용
├── app.css                         컴포넌트 스타일 (디자인 시스템 외 추가 클래스)
│
├── source/
│   ├── BRIEF.md                    원본 디자인 브리프
│   └── TOKENS.md                   현재 코드 기준 토큰 분석 (before)
│
├── screenshots/                    ★ 페이지 PNG 캡처 (desktop 19 + mobile 7)
│   ├── 01-dashboard.png            E. 대시보드 (랜딩)
│   ├── 02-project-detail.png       A. 프로젝트 상세
│   ├── 03-pipeline-builder.png     B. 파이프라인 빌더 (lane variant — novel)
│   ├── 04-pipeline-run.png         C. 파이프라인 실행 + 히스토리
│   ├── 05-content-library.png      D. 내 컨텐츠
│   ├── 06-workboard-run.png        F. 작업판 단발 실행 (여정 B)
│   ├── 07-workboard-editor.png     G. 작업판 정의 admin (3-pane novel)
│   ├── 08-admin-servers.png        H. 서버 관리 admin
│   ├── 09-command-palette.png      ⌘K 명령 팔레트 (오버레이)
│   ├── 10-notifications.png        벨 popover (열림 상태)
│   ├── 11-dark-dashboard.png       다크 모드: 대시보드
│   ├── 12-dark-pipeline-builder.png 다크 모드: 파이프라인 빌더
│   ├── 13-dark-pipeline-run.png    다크 모드: 파이프라인 실행
│   ├── 14-migration-guide-top.png  마이그레이션 가이드 — 히어로/통계
│   ├── 15-migration-guide-phase.png 마이그레이션 가이드 — phase 디테일
│   ├── 16-admin-users.png          I. 사용자/그룹 관리 admin
│   ├── 28-work-history.png         N. 작업 히스토리 — 전체/이미지 (계속하기·다른 작업 버튼)
│   ├── 29-work-history-video.png   N. 작업 히스토리 — 영상 필터 (재생 오버레이)
│   ├── 30-work-history-text.png    N. 작업 히스토리 — 텍스트 필터 (본문 미리보기)
│   │
│   ├── 17-mobile-dashboard.png         (모바일) 대시보드
│   ├── 18-mobile-project-detail.png    (모바일) 프로젝트 상세 — 헤더/액션
│   ├── 19-mobile-project-detail-tabs.png (모바일) 탭 드롭다운 (가로 스크롤 X)
│   ├── 20-mobile-pipeline-builder.png  (모바일) "탭하여 편집" pill 적용
│   ├── 21-mobile-pipeline-run.png      (모바일) 파이프라인 실행
│   ├── 22-mobile-content-library.png   (모바일) 내 컨텐츠
│   └── 23-mobile-workboard-run.png     (모바일) 작업판 실행 폼
│
└── prototypes/
    ├── VCC Manager Design.html              ★ 디자인 캔버스 — 13 섹션, 모든 mockup
    ├── VCC Manager Migration Guide.html     ★ 8단계 PR 분해 가이드 — 먼저 읽기
    ├── Prototype.html                       ★ 클릭 가능한 prototype (사용자 + admin 전 화면)
    │
    ├── icons.jsx                            ★ 아이콘 set (40개)
    ├── shell.jsx                            사이드바 + 탑바 (앱 chrome)
    │
    ├── page-dashboard.jsx                   E. 대시보드
    ├── page-history.jsx                      N. 작업 히스토리 (전역 통합 피드)
    ├── page-project-detail.jsx              A. 프로젝트 상세
    ├── page-pipeline-builder.jsx            B. 파이프라인 빌더 (lane + list variants)
    ├── page-pipeline-builder-graph.jsx      B-alt2. graph variant
    ├── page-pipeline-run.jsx                C. 파이프라인 실행 + 히스토리
    ├── page-content-library.jsx             D. 내 컨텐츠
    ├── workboard-shared.jsx                 ★ 공유 카드 + 2축 필터 (L · P 공용)
    ├── page-workboard-list.jsx              L. 작업판 카탈로그 (사용자 · 실행)
    ├── page-workboard-run.jsx               F. 작업판 단발 실행
    ├── page-workboard-editor.jsx            G. 작업판 정의 (admin)
    ├── workboard-picker.jsx                 Q. 다른 작업 전환 picker (모달)
    ├── page-admin-dashboard.jsx             O. 관리자 대시보드 (운영 허브)
    ├── page-admin-workboards.jsx            P. 작업판 관리 (admin · 거버넌스)
    ├── page-admin-servers.jsx               H. 서버 관리 (admin)
    ├── page-admin-users.jsx                 I. 사용자 / 그룹 (admin)
    ├── page-admin-stats.jsx                 시스템 통계 (admin · 분석)
    ├── page-auth.jsx                        J. 로그인 + 가입
    │
    ├── command-palette.jsx                  ⌘K 명령 팔레트
    ├── notifications.jsx                    벨 popover
    │
    ├── canvas-sections.jsx                  (디자인 캔버스 전용 — 무시 가능)
    ├── extras.jsx                           (디자인 캔버스 전용 — 무시 가능)
    ├── design-canvas.jsx                    (디자인 캔버스 starter — 무시 가능)
    └── tweaks-panel.jsx                     (개발용 토글 — 프로덕션 제외)
```

---

## How to use these files in your code

1. **먼저 마이그레이션 가이드를 읽으세요**: `prototypes/VCC Manager Migration Guide.html`을 브라우저에 띄워두고 작업.
2. **Phase 1부터 시작**: `theme.ts`를 코드베이스의 `frontend/src/theme.ts`로 복사 → `createTheme(vccTheme)`. 한 PR.
3. **각 페이지 구현 시**:
   - 해당 `.jsx` 파일을 브라우저 devtools로 검사 (`Prototype.html`에서 페이지 도크로 이동)
   - 정확한 측정값을 DOM에서 추출 (간격, 폰트 크기 등은 모두 inline style에 명시됨)
   - 한국어 라벨/copy는 그대로 사용 (의도된 톤)
   - 인라인 SVG `Icon.*`는 자체 set 유지 권장
4. **모바일 변형 확인**: `Prototype.html` 우상단 Mobile 토글 + `mobile` prop
5. **다크모드는 옵트인**: Phase 7에서 처리. MUI `colorSchemes` API 권장.

## Don't

- ❌ HTML 파일을 그대로 빌드에 포함 (이건 디자인 레퍼런스)
- ❌ `tweaks-panel.jsx`, `design-canvas.jsx`, `canvas-sections.jsx`, `extras.jsx`를 프로덕션에 포함
- ❌ Pretendard CDN을 그대로 사용 (자체 호스팅 권장 — privacy + 속도)
- ❌ 새 hex 색상을 코드에 직접 추가 (반드시 `theme.palette.*` 또는 `var(--*)` 통해)

---

## Questions to resolve before implementation

다음 사항들은 원본 브리프에서 결정되지 않았거나 디자이너가 추가로 명확히 하고 싶은 부분. PM/디자이너에게 확인 필요:

1. **파이프라인 빌더 variant 결정**: lane (novel) / list (안전) / graph (most novel) 중 1차 출시는 어느 것? (현재 디자인 권장: lane)
2. **다크모드 전환 UX**: 사용자 설정 페이지 / 시스템 선호도 추적 / OS따라 자동 중 어느 패턴?
3. **알림 영구 저장**: 현재 디자인은 popover만. 별도 알림 inbox 페이지는 다음 라운드?
4. **모바일 Pipeline Builder**: 모바일에선 list 변형만 노출 권장. 확정?
5. **사용자 프로필 페이지**: 이번 라운드 out-of-scope. 우선순위?
6. **온보딩 wizard**: 첫 가입자 흐름. 우선순위?

---

*Generated 2026-05 · VCC Manager Design System v1.2*

**변경 이력**
- **v1.2** — 작업판 카탈로그를 **2축 필터(출력 형식 × 서버 타입)** 다중선택으로 전환 + 사용자/관리자 화면이 공유 카드·필터(`workboard-shared.jsx`) 사용. 사용자 목록 "새 작업판" 제거(생성 불가). **관리자 대시보드**(`page-admin-dashboard.jsx`, 운영 허브) · **작업판 관리**(`page-admin-workboards.jsx`, 거버넌스) 신설 — 시스템 통계와 별개 라우트. **다른 작업 전환 picker**(`workboard-picker.jsx`) 신설. 서버 관리에서 모델 리스트·"총 모델" 통계 제거 + 모바일 세로 적층 레이아웃. 관리자 사이드바 활성 하이라이트 수정.
- **v1.1** — 대시보드 상단 통계 4블록 제거 · 작업 히스토리 페이지(`page-history.jsx`) 신설 — 이미지·영상 행에 "계속하기"/"다른 작업" 재개 버튼 2종 추가.
