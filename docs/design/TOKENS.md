# VCC Manager — 현재 디자인 토큰 추출

> 코드 그렙 결과 기준 (2026-05). 디자인 시스템 작업의 input 자료.
> 산출물 (재정의된 토큰) 은 별도 `tokens-v1.json` / MUI ThemeOptions 으로 받기.

---

## 1. 컬러 (Color)

### 1.1 MUI 테마 정의 (`frontend/src/App.js:55-64`)

```js
{
  primary:   { main: '#1976d2' },  // 표준 MUI blue
  secondary: { main: '#dc004e' },  // 강조 red/magenta
}
```
> 그 외 success / error / warning / info / grey 는 MUI 기본값 사용. 명시 재정의 없음.

### 1.2 하드코딩 hex (테마 미사용)

| Hex | 의미 / 용도 | 사용 위치 |
|-----|------------|---------|
| `#34495e` | AppBar 배경, Sidebar 활성 항목 | `Header.js:67`, `Sidebar.js` (5회) |
| `#2c3e50` | Sidebar 주 배경 | `Sidebar.js:22, 274, 291` (3회) |
| `#ecf0f1` | Sidebar 텍스트 / 아이콘 | `Sidebar.js` (2회) |
| `#bdc3c7` | Sidebar 보조 텍스트 | `Sidebar.js:51` |
| `#e74c3c` | 강조 빨강 (로그아웃, admin 경고) | `Sidebar.js` (2회) |
| `#f5f5f5` | 콘텐츠 영역 배경 | `App.js:57`, Auth pages (3회) |
| `#9c27b0` | 세계관 태그 색 | `builtinTags.js:10` |
| `#2196f3` | 시스템 프롬프트 태그 색 | `builtinTags.js:11` |
| `#7c4dff` | 프로젝트 태그 기본 색 | `ProjectDetail.js:872` |

**문제**: 사이드바 / 헤더 색 (`#2c3e50` 계열) 이 코드에 흩어져 있음 → 테마 palette 의 `navbar` 같은 새 토큰으로 정리 필요.

### 1.3 rgba 투명도 패턴

| Pattern | 용도 | 빈도 |
|---|---|---|
| `rgba(255,255,255,0.1)` | 다크 영역 위 divider | 2회 |
| `rgba(255,255,255,0.6~0.9)` | 호버 / 오버레이 | 4회 |
| `rgba(0,0,0,0.6)` | 다크 오버레이 (이미지 위 그라데이션) | 3회 |
| `rgba(76,175,80,0.08)` | 성공 단계 배경 (라이트 톤) | PipelinePanel |
| `rgba(156,39,176,0.04)` | 세계관 카드 배경 | ConversationHistoryPanel |

**문제**: 같은 의미 (예: success bg, info bg) 가 임의 알파 값. tone-on-tone palette 정의 필요.

---

## 2. 타이포그래피 (Typography)

### 2.1 Variant 사용 분포

| Variant | 빈도 | 주된 용도 |
|---|---|---|
| `body2` | 158 | 메타 / 설명 / 보조 정보 |
| `caption` | 116 | 라벨, 파일명, 메타데이터 |
| `h6` | 72 | 섹션 헤더, 카드 제목 |
| `body1` | 48 | 본문 |
| `h4` | 26 | 큰 통계 / 페이지 제목 |
| `h5` | 8 | 페이지 제목 (드물게) |
| `subtitle1/2` | 12 | 부제, 카테고리 라벨 |

### 2.2 색상 prop

- `color="text.secondary"` (MUI v5 권장) ↔ `color="textSecondary"` (deprecated, 구형) 혼용.
- `color="primary" / "error" / "warning"` 상태별 강조 시 사용.

### 2.3 폰트 패밀리

- 기본: Roboto (MUI 기본)
- 명시: `fontFamily: 'monospace'` — `MetadataImageListItem.js`, `TextContentPanel.js`, `ProjectDetail.js` (파일명 / 작업판 ID 표시)
- **한국어 fallback 미지정** — 시스템 폰트 처리됨. 디자인에서 한국어 가독성 고려 권장 (Pretendard / Noto Sans KR 등).

---

## 3. 간격 (Spacing)

> MUI 의 spacing 단위는 `theme.spacing(1) = 8px` 기본.

### 3.1 padding / margin 단위 분포

| 값 | 픽셀 | 빈도 | 권장 용도 |
|---|---|---|---|
| `0.5` | 4px | 빈번 | 마이크로 (chip, 작은 gap) |
| `1` | 8px | 매우 빈번 | 컴팩트 (gap, 작은 행간) |
| `1.5` | 12px | 빈번 | 모바일 padding |
| `2` | 16px | 매우 빈번 | 표준 padding |
| `3` | 24px | 빈번 | 데스크탑 padding |
| `4` | 32px | 중간 | 큰 컨테이너 (auth) |

**패턴**: 표준 `p: 2`, 데스크탑 큰 `p: 3`, 모바일 컴팩트 `p: 1.5`. 가이드라인 명문화 권장.

### 3.2 반응형 spacing

| 패턴 | 빈도 | 예시 |
|---|---|---|
| `p: { xs: 1.5, md: 3 }` | 8회 | 데스크탑/모바일 padding 구분 |
| `mt: { xs: 2, md: 4 }` | 5회 | 페이지 상단 여백 |
| `flexWrap: { xs: 'wrap', sm: 'nowrap' }` | 3회 | 컨트롤 행 |
| `display: { xs: 'none', md: 'block' }` | 4회 | 반응형 표시/숨김 |

### 3.3 Breakpoint 사용 빈도

| Breakpoint | 등장 | 의미 |
|---|---|---|
| `xs` (~360px) | 38 | 모바일 |
| `sm` (~600px) | 18 | 거의 미사용 |
| `md` (~960px) | 52 | 데스크탑 |
| `lg` (~1280px) | 4 | 거의 미사용 |
| `xl` (~1536px) | 1 | 미사용 |

**디자인 권고**: `sm/lg/xl` 미사용 → \"모바일 (xs) / 데스크탑 (md)\" 2단계 단순화 혹은 정식 3단계 (mobile / tablet / desktop) 채택 결정 필요.

---

## 4. 둥글기 / 그림자 (Border Radius & Shadow)

### 4.1 borderRadius

| 값 | 빈도 | 용도 |
|---|---|---|
| `1` (8px) | 27 | 카드, 칩, 인풋 — 표준 |
| `2` (16px) | 6 | 큰 카드 / progress bar |
| `4` (32px) | 6 | 진행바 끝 둥금 |
| `'50%'` | 1 | 원형 아이콘 배경 |

### 4.2 elevation

| 값 | 빈도 | 용도 |
|---|---|---|
| `elevation={1}` | 3 | 채팅 패널 (낮은 강조) |
| `elevation={3}` | 8 | 인증 페이지 메인 폼 |
| `variant=\"outlined\"` | 140+ | 콘텐츠 영역 카드 (선호) |

**관행**:
- `elevation` = depth 표현이 필요한 곳 (auth modal 같은 띄움 효과)
- `variant=\"outlined\"` = flat 콘텐츠 영역 (정보 표현)

### 4.3 커스텀 box-shadow

- `boxShadow: 2` (hover) — `JobHistoryPanel`
- `boxShadow: '0 4px 8px rgba(0,0,0,0.2)'` (hover) — `JobHistoryPanel`

---

## 5. 컴포넌트 패턴

### 5.1 Button

| Variant | 빈도 | 비고 |
|---|---|---|
| `contained` | 77 | 주요 액션 (생성, 시작, 저장) |
| `outlined` | 137 | 보조 액션, 토글 |
| `text` | 1 | 거의 미사용 |

| Size | 빈도 |
|---|---|
| `size=\"small\"` | 312 |
| `size=\"large\"` | 11 |
| 기본 (medium) | 거의 미사용 |

**권장**: 테마 단계에서 Button defaultProps 로 `size: small` 지정 → 매번 명시 안 해도 됨.

### 5.2 Chip

- 거의 항상 `size=\"small\"` + `variant=\"outlined\"`
- 상태별 color (`primary` / `success` / `warning` / `error`) 사용

### 5.3 Card / Paper

- 콘텐츠 영역 카드: `<Paper variant=\"outlined\">` 압도적
- 띄움 효과: `<Paper elevation={1 or 3}>` — 채팅 패널, 인증

### 5.4 Tabs

- 모바일 5개 이상 탭 = `variant=\"scrollable\"` + `scrollButtons={false}` (#383 fix)
- 탭 영역을 `Box bgcolor: 'background.paper'` 로 감싸기 (둥둥 뜨는 느낌 방지)

---

## 6. 통일성 부족 우선순위

| 항목 | 현황 | 영향 | 처리 |
|---|---|---|---|
| AppBar / Sidebar 색이 hardcoded hex | `#34495e` / `#2c3e50` 흩어짐 | **HIGH** | `theme.palette.navbar` 같은 새 토큰 추가 |
| `color=\"textSecondary\"` vs `text.secondary` | 혼용 | MEDIUM | `text.secondary` 통일 |
| Button size 미지정 = medium 인데 거의 small 만 씀 | 매번 size=\"small\" 적기 번거로움 | MEDIUM | 테마 defaultProps 로 small 지정 |
| borderRadius 1 / 2 / 4 혼용 | LOW | 사용 패턴 명문화 (1 표준, 2 강조 카드, 4 진행바 끝) |
| sm / lg / xl breakpoint 미사용 | LOW | 3단계 (mobile / tablet / desktop) 정식화 또는 2단계 (mobile / desktop) 채택 |
| 한국어 fallback 폰트 미지정 | MEDIUM | 한국어 폰트 (Pretendard / Noto Sans KR) 추가 |

---

## 7. 디자인 시스템 작업 시 권장 산출물

### 7.1 토큰 형식

MUI ThemeOptions 으로 받을 수 있게 (디자이너 → 개발 직접 변환):

```js
// 예시 — 디자인 결과를 이 모양으로 받으면 코드 즉시 교체 가능
const designTokens = {
  palette: {
    primary:   { main: ..., light: ..., dark: ..., contrastText: ... },
    secondary: { ... },
    navbar:    { main: ..., contrastText: ... }, // 신규 — sidebar/header 통일
    success:   { ... }, warning: { ... }, error: { ... }, info: { ... },
    background: { default: ..., paper: ... },
    text: { primary: ..., secondary: ..., disabled: ... },
    divider: ...,
  },
  typography: {
    fontFamily: '\"Pretendard\", \"Noto Sans KR\", \"Roboto\", ...',
    h4: { fontSize: ..., fontWeight: ..., lineHeight: ... },
    body1: { ... },
    // ... 등
  },
  shape: { borderRadius: 8 },       // 기본 (= MUI 1 unit)
  spacing: 8,                         // 기본
  shadows: [...],                     // elevation 단계별
  components: {                       // defaultProps / styleOverrides
    MuiButton: { defaultProps: { size: 'small' } },
    MuiChip:   { defaultProps: { size: 'small', variant: 'outlined' } },
    // ...
  },
};
```

### 7.2 컴포넌트 변형 (Figma 추출 가능)

- Card (기본 / 강조 / 위험 / 정보)
- Chip (상태별 / 사이즈별 / 클릭형 / 정적)
- Button (variant × size × color matrix)
- Tabs (데스크탑 / 모바일 컴팩트 / scrollable)
- Stepper (vertical / horizontal / inline status)
- Empty state
- Loading state
- Toast / Alert
- Dialog (작은 / 중 / 큰 / 전체)

### 7.3 페이지 mockup

- 프로젝트 상세 (탭별 본문)
- 파이프라인 빌더 (단계 리스트 + 사전 입력 dialog + 문서 연결 dialog)
- 파이프라인 실행 + 히스토리 (Stepper + 결과)
- 데스크탑 (1440 / 1280) + 모바일 (390) 각각

---

## 8. 첨부 자료 (사용자가 직접 캡처 / 첨부)

디자인 에이전트에 함께 넘길 자료:
- [ ] 프로젝트 상세 페이지 — 데스크탑 / 모바일
- [ ] 파이프라인 빌더 — 데스크탑 / 모바일
- [ ] 파이프라인 실행 / 히스토리 — 데스크탑 / 모바일
- [ ] (선호) 톤 reference: Notion / Linear / Vercel / Stripe dashboard 같은 정돈된 productivity 도구 캡처
- [ ] (있다면) 브랜드 색 / 로고 가이드
