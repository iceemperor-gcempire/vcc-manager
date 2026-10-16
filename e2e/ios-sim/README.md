# iOS 시뮬레이터 레이아웃 검사

실제 iOS Safari(WebKit)에서 앱의 모든 화면을 열어 **가로 넘침**과 **제목 줄 수**를 재고, 화면마다 스크린샷을 남긴다 (#1057).

Playwright 는 데스크톱 Chromium 으로 페이지 이동만 확인해서 모바일에서만 생기는 깨짐을 못 잡았다. 그런 예가 둘 있다.
- #1053: 좁은 화면에서 작업판 관리 제목이 한 글자씩 세로로 쌓였다
- #1054: 업데이트 안내창의 긴 파일 이름이 본문을 옆으로 밀었다

이 검사는 고치기 전 값을 페이지에 재현했을 때 #1053 을 잡는 것을 확인했다 (제목 폭 24px·5줄).

**언제**: UI 에 영향 있는 변경이 들어간 마이너 이상 릴리스 전에, 알파에서 돌린다. 폭은 **390px·440px 두 가지**, 화면은 **로그인 뒤 화면과 로그인 전 화면(`--public`) 둘 다**다. 결과 요약은 dev → main PR 에 붙인다.

## 준비물

- macOS + Xcode (`xcrun simctl`), iOS 시뮬레이터 런타임
- 로컬 docker-compose 스택 (`http://localhost:8136`). 시뮬레이터는 호스트 네트워크를 같이 써서 `localhost` 로 닿는다
- Web Inspector → Chrome DevTools Protocol 브리지 **inspect-webkit**
  - Orca 앱에 들어 있는 것을 쓴다: `/Applications/Orca.app/Contents/Resources/node_modules/inspect-webkit/dist/cli.js`
  - 경로가 다르면 `INSPECT_WEBKIT_CLI` 로 준다. 저장소 의존성으로는 넣지 않았다 (Orca 경로가 자주 깨지면 그때 넣는다)
  - 검사 스크립트가 포트(기본 9322)에 브리지가 없으면 직접 띄우고, 끝날 때 자기가 띄운 것만 끈다

## 절차

### 1. 시뮬레이터를 하나만 켠다

```bash
xcrun simctl list devices available | grep iPhone        # UDID 확인
orca emulator attach <UDID>                               # Orca 안이면 (화면이 Orca 창에 뜬다)
xcrun simctl boot <UDID> && open -a Simulator             # 또는 Orca 없이
xcrun simctl ui <UDID> appearance dark                    # 다크 모드도 볼 때
xcrun simctl openurl <UDID> http://localhost:8136/login   # Safari 에서 앱을 연다
```

- 390px: iPhone 17e · 16e. 440px: iPhone 17 Pro Max · 16 Pro Max
- 기기 이름은 iOS 런타임마다 겹치니 UDID 로 고른다
- **부팅된 시뮬레이터가 둘 이상이면 검사가 멈춘다.** Orca 의 `attach` 는 새 기기를 켜면서 이전 기기를 끈다

### 2. 로그인 — 테스트 페이즈에 따라 다르다

| 페이즈 | 방법 |
|---|---|
| **QA** | 시뮬레이터 Safari 에서 **직접 로그인**한다. 사용자가 밟는 경로 그대로다 |
| **개발 중** | 개발용 쿠키를 심는다 (아래) |

```bash
node e2e/ios-sim/dev-login-cookie.js --email <계정 이메일>     # 켜 둔 채로 검사를 돌린다
```

- 이 도구는 로컬 백엔드 컨테이너에서 그 계정의 토큰을 발급해 **메모리에만** 들고 있는다
- 같은 `localhost` 에 심은 쿠키는 포트를 가리지 않고 앱으로 간다. 그래서 앱 주소가 `localhost` 가 아니면 거부한다
- 쿠키는 1시간 뒤 만료된다. **Ctrl+C** 로 끄면 시뮬레이터에서 쿠키를 지운다
- 관리자 화면까지 보려면 관리자 계정을 쓴다. 권한이 없는 화면은 "예상 밖 이동"으로 표시된다

### 3. 검사

```bash
pnpm run test:ios-sim                       # 로그인 뒤 화면
pnpm run test:ios-sim -- --public           # 로그인 전 화면 — 로그아웃한 뒤 (개발용 쿠키는 Ctrl+C)
pnpm run test:ios-sim -- /admin/workboards  # 고른 화면만
```

- 옵션: `--settle <ms>` (화면이 뜬 뒤 기다리는 시간, 기본 3000), `--out <dir>`, `--keep-dialogs`, `--app <url>`, `--cdp-port <n>`
- 결과는 표로 나오고, 스크린샷과 `report.json` 은 `test-results/ios-sim/<시각>-<기기>/` 에 남는다 (git 에 들어가지 않는다)

### 4. 다른 폭으로 반복하고 정리한다

- 시뮬레이터를 바꿔 2~3 을 반복한다
- 브리지를 직접 띄워 뒀다면 기기를 바꾼 뒤 재시작한다. 스크립트가 띄운 브리지는 매번 새로 뜬다
- 다 끝나면 `orca emulator shutdown --device <UDID>` 또는 `xcrun simctl shutdown <UDID>` 로 끈다

## 화면 목록과 판정

화면 목록은 `frontend/src/App.js` 의 `<Route path>` 에서 읽는다. 사본은 두지 않는다. 모든 화면이 결과에 한 줄씩 나온다.

| 결과 | 뜻 |
|---|---|
| 통과 | 아래 기준을 모두 만족 |
| 문제 | 문서에 가로 스크롤이 생김 (`scrollWidth > clientWidth`) · 가로 스크롤 영역 밖으로 요소가 삐져나옴 · `h1` 이 세 줄 이상 |
| 측정 못 함 | 견본 ID 규칙이 없는 새 `:param` 화면 · 이 인스턴스에 견본이 없음 · 다른 주소로 튕김 (권한·로그인) |
| 건너뜀 | 이번 모드 대상이 아님 · `<Navigate>` 만 하는 이동 주소 · 일회용 토큰이 필요한 화면 |

종료 코드: `0` 전부 측정하고 통과 · `2` 측정 못 한 화면이 있음 · `1` 문제 또는 오류.

`App.js` 에 `:param` 화면을 새로 넣으면 `layout-check.js` 의 `PARAM_SAMPLES` 에 견본 규칙도 넣는다. 안 넣으면 "측정 못 함"으로 드러난다.

## 주의

- **업데이트 안내창은 닫으면 계정에 '봤음'이 기록된다.** 배경을 탭하거나 Esc 를 눌러도 기록된다. 그래서 검사는 안내창을 누르지 않고 DOM 에서만 치운다. 안내창 자체를 보려면 `--keep-dialogs` 를 쓴다
- Safari 탭이 여럿이면 화면에 보이는 탭을 잰다. 스크린샷은 보이는 탭만 찍힌다
- 브리지는 비동기 평가(`awaitPromise`)를 받지 않는다. 그래서 페이지 안 API 호출은 결과를 페이지 변수에 받아 두고 읽어 온다
