# VCC Design System v2 — 토큰 스펙

- **확정**: 2026-06-12 (방향: B Warm Studio 라이트 + C Dark Console 다크, 이중 포인트 승인)
- **구현 단일 소스**: `frontend/src/theme.js` (`buildVccTheme(mode)`) — 이 문서와 어긋나면 theme.js 가 정답
- **시각 시트**: [tokens-v2.html](tokens-v2.html) (브라우저로 열기)
- **기능 기준**: [FEATURE-INVENTORY.md](FEATURE-INVENTORY.md) — 여기 없는 기능은 디자인하지 않는다
- v1 핸드오프(`../design/design_handoff_vcc_manager/`)는 **폐기** — 앱에 없는 기능이 다수 포함

## 원칙

1. **구조 토큰은 모드 공통, 컬러만 모드별** — 두 모드는 같은 앱, 다른 분위기
2. **이중 포인트**: 라이트 = 테라코타, 다크 = 민트 (의도된 정체성)
3. 페이지는 색·간격·폰트를 직접 쓰지 않는다 — theme 토큰과 `components/common/` 라이브러리만 호출 (CLAUDE.md UI 규칙)
4. **텍스트는 라이트·다크 양쪽에서 WCAG AA 를 만족한다** (본문 4.5:1 / 24px+ 또는 굵은 18.66px+ 는 3:1). 토큰을 새로 넣거나 바꿀 때는 **두 모드 모두** 측정할 것 — 한쪽만 보면 반대쪽이 깨진다 (#727)

## `.light` 은 "틴트" — MUI 파생과 충돌 주의 (#727)

v2 는 `palette.*.light` 를 **저알파 틴트 배경**으로 재정의했다. 그런데 MUI 는 `.light` 을 "밝은 명도 변형" 으로 가정하고 일부 컴포넌트가 여기서 **글자색을 파생**한다.

- 실제 사고: 다크모드 `<Alert>` 본문이 `rgba(...,0.14)` 를 글자색으로 물려받아 대비 **1.36:1** (사실상 안 보임). `theme.js` 의 `MuiAlert` 오버라이드로 배경/글자/아이콘을 명시 지정해 해결.
- MUI v5 소스 기준 `palette[color].light` 를 참조하는 컴포넌트는 **Alert 뿐**. 새 MUI 컴포넌트를 도입할 때 이 목록을 다시 확인할 것.
- 틴트 위에 글자를 얹을 때: **라이트는 `.dark`, 다크는 `.main`** (`ToneChip` 이 이 규칙의 기준 구현). 라이트 틴트는 밝아서 `.main` 이 묻힌다.

## 구조 토큰 (모드 공통)

| 토큰 | 값 |
|---|---|
| radius | 카드 10 · 컨트롤 8 · 버튼/칩 pill(999) |
| spacing | 1단위 = 4px |
| 폰트 | Pretendard (본문) · JetBrains Mono (`MONO` export — id/메타/숫자) |
| 타입 스케일 | h1 24/800(-0.02em) · h2 18/700 · h3 15/700 · h6 13.5/700(카드 타이틀) · body1 13.5 · body2 12.5 · caption 11.5 · overline 11/700 |
| 버튼 | pill, weight 700, sm 30px / lg 38px |
| 그림자 | 라이트: warm 소프트 (카드 기본 적용) / 다크: 보더 위주 + 딥 블랙 |

## Light — Warm Studio

| 역할 | 값 |
|---|---|
| bg / surface | `#F6F2EC` / `#FFFDFA` |
| divider / strong | `#E8E0D4` / `#D6CBB9` (grey.300/400) |
| text 1/2/3/disabled | `#2A241C` / `#6E6557` / `#776E5F` / `#C9C0B2` |
| **primary (테라코타)** | main `#C96A3B` · dark `#A04E26` · tint `#F7E8DF` |
| secondary (진행 보라) | `#7A5CC4` · tint `#EFE9F9` |
| success / warning / error / info | `#4D8A4D` / `#B07514` / `#C73E44` / `#4A7DBF` (+각 tint) |
| navbar | bg 와 한 몸 `#F6F2EC`, 활성 `#FFFDFA`(surface) |

## Dark — Console

| 역할 | 값 |
|---|---|
| bg / surface | `#101216` / `#181B21` |
| divider / strong | `#262B34` / `#343B47` |
| text 1/2/3/disabled | `#E9EBEF` / `#9AA1AD` / `#808895` / `#3E434C` |
| **primary (민트)** | main `#3DD6B8` · dark `#2AA890` · tint rgba(61,214,184,.12) · on-accent `#06231D` |
| secondary | `#9B7CE0` | 
| success / warning / error / info | `#3DD68C` / `#E0B341` / `#ED7178` / `#5C9CE8` (+rgba tint) |
| navbar (콘솔 레일) | `#0B0D10`, 활성 `#181B21` |
| grey 스케일 | 다크 반전 정책 유지 (#442) — `grey.50~300` 은 어두운 surface |

## 표기 규칙

- **시각**: 목록·카드의 "언제"는 `utils/relativeTime` (7일 지나면 `yy. M. d.` 폴백). 상세 다이얼로그·관리 테이블처럼 **정확한 시점이 필요한 곳만** 절대 표기 (#730)
- **명칭**: 한 화면은 한 이름으로만 부른다 — `/content` 는 **"내 콘텐츠"** (사이드바·명령 팔레트·페이지 제목·대시보드 링크 일치). 표준어는 "콘텐츠" (컨텐츠 아님)
- **빈 값**: 카드에서 설명이 비면 placeholder 문구 대신 자리를 비운다. 높이 정렬이 필요하면 `minHeight` 로 확보
- **주 액션 색**: primary 고정. success/warning 등 의미색은 상태 표시에만 쓰고 버튼에 쓰지 않는다
- **폰트 크기** (#730): 본문은 `variant` 또는 타입 스케일 값만. `rem` 문자열 금지 (v2 는 px 기준).
  단 **아이콘 크기 지정용 `fontSize` 는 타이포가 아니므로 예외** — MUI 가 SVG 아이콘 크기를 `fontSize` 로 받는다.
  이 구분이 없으면 "폰트는 토큰 경유" 규칙이 아이콘까지 잡아 검증이 불가능해진다

## 컴포넌트 라이브러리 (직접 호출 — 사본 생성 금지)

`frontend/src/components/common/`: PageHeader · SegmentTabs · EmptyState · ToneChip (+화면 라운드에서 추가 예정)
공용 유틸: `utils/brandGradients` (아바타/타일 그라데이션 6종, v2 세트) · `utils/relativeTime` · `theme.MONO`
