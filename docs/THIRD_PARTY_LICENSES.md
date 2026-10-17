# 사용 중인 오픈소스 라이브러리

> **생성 파일 — 직접 고치지 않는다.** 릴리스 전에 `pnpm run licenses:update` 로 다시 만든다
> (source: 각 구성의 `pnpm-lock.yaml` 과 설치된 패키지, 생성기 `scripts/third-party-notices.cjs`).

운영 의존성만 싣는다 (개발·테스트 도구 제외). 라이선스 **원문**은 빌드할 때 만들어지는 고지 파일에 있다.

- 웹 화면: 설정 → 정보 → 오픈소스 라이선스 (`/third-party-licenses.txt`)
- 백엔드·MCP 서버: 각 컨테이너의 `/app/THIRD_PARTY_LICENSES.txt`

GPL·LGPL 처럼 원문을 함께 실어야 하는 라이선스는 `scripts/license-texts/` 의 원문을 고지 끝에 부록으로 붙인다.

백엔드 이미지에는 시스템 패키지 **ffmpeg** 도 들어간다 (Alpine 빌드, 동영상 썸네일·업로드 faststart 처리에 별도 프로세스로만 호출).
버전과 라이선스는 빌드할 때 이미지 안의 `ffmpeg -L` 에서 읽어 고지에 적는다 — 아래 목록에는 없다.

## 요약

| 구성 | 패키지 | 라이선스 |
|---|---|---|
| 백엔드 | 250 | MIT 197 · Apache-2.0 20 · ISC 13 · BSD-3-Clause 11 · BlueOak-1.0.0 4 · BSD-2-Clause 2 · LGPL-3.0-or-later 1 · MIT-0 1 · Unknown 1 |
| 웹 화면 | 214 | MIT 205 · BSD-3-Clause 3 · ISC 3 · (MPL-2.0 OR Apache-2.0) 1 · 0BSD 1 · Apache-2.0 1 |
| MCP 서버 | 91 | MIT 81 · ISC 7 · BSD-3-Clause 2 · BSD-2-Clause 1 |

## 검토한 라이선스

허용형(MIT·ISC·BSD·Apache-2.0 등) 밖의 라이선스는 들어올 때 사람이 보고 판단을 `scripts/third-party-license-review.json` 에 남긴다.

| 패키지 | 라이선스 | 판단 |
|---|---|---|
| `@img/sharp-libvips-*` | LGPL-3.0-or-later | sharp 의 네이티브 모듈이 동적 링크하는 libvips 공유 라이브러리(libvips-cpp, 별도 패키지). 고치지 않고 쓰며 바꿔 끼울 수 있다. 고지에 README 의 라이선스 절(함께 묶인 라이브러리 표)과 LGPL-3.0·GPL-3.0 원문 부록을 싣는다 |
| `dompurify` | (MPL-2.0 OR Apache-2.0) | 이중 라이선스 중 Apache-2.0 을 따른다. 고치지 않고 쓴다 |
| `pause` | Unknown | package.json 에 표기가 없지만 README 에 MIT 원문이 있다 (passport 의존성) |

## 백엔드 (`.`)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| `@hapi/address` | 5.1.1 | BSD-3-Clause |
| `@hapi/formula` | 3.0.2 | BSD-3-Clause |
| `@hapi/hoek` | 11.0.7 | BSD-3-Clause |
| `@hapi/pinpoint` | 2.0.1 | BSD-3-Clause |
| `@hapi/tlds` | 1.1.7 | BSD-3-Clause |
| `@hapi/topo` | 6.0.2 | BSD-3-Clause |
| `@img/colour` | 1.1.0 | MIT |
| `@img/sharp-darwin-arm64` † | 0.34.5 | Apache-2.0 |
| `@img/sharp-libvips-darwin-arm64` † | 1.2.4 | LGPL-3.0-or-later |
| `@ioredis/commands` | 1.10.0 | MIT |
| `@isaacs/cliui` | 8.0.2 | ISC |
| `@mongodb-js/saslprep` | 1.4.12 | MIT |
| `@msgpackr-extract/msgpackr-extract-darwin-arm64` † | 3.0.4 | MIT |
| `@pkgjs/parseargs` | 0.11.0 | MIT |
| `@redis/bloom` | 1.2.0 | MIT |
| `@redis/client` | 1.6.1 | MIT |
| `@redis/graph` | 1.1.1 | MIT |
| `@redis/json` | 1.0.7 | MIT |
| `@redis/search` | 1.2.0 | MIT |
| `@redis/time-series` | 1.1.0 | MIT |
| `@standard-schema/spec` | 1.1.0 | MIT |
| `@types/webidl-conversions` | 7.0.3 | MIT |
| `@types/whatwg-url` | 11.0.5 | MIT |
| `abort-controller` | 3.0.0 | MIT |
| `accepts` | 1.3.8 | MIT |
| `agent-base` | 6.0.2 | MIT |
| `ansi-regex` | 5.0.1 | MIT |
| `ansi-styles` | 4.3.0 | MIT |
| `append-field` | 1.0.0 | MIT |
| `archiver` | 7.0.1 | MIT |
| `archiver-utils` | 5.0.2 | MIT |
| `array-flatten` | 1.1.1 | MIT |
| `async` | 3.2.6 | MIT |
| `asynckit` | 0.4.0 | MIT |
| `axios` | 1.18.1 | MIT |
| `b4a` | 1.8.1 | Apache-2.0 |
| `balanced-match` | 1.0.2 | MIT |
| `bare-events` | 2.9.1 | Apache-2.0 |
| `bare-fs` | 4.7.4 | Apache-2.0 |
| `bare-path` | 3.1.1 | Apache-2.0 |
| `bare-stream` | 2.13.3 | Apache-2.0 |
| `bare-url` | 2.4.5 | Apache-2.0 |
| `base64-js` | 1.5.1 | MIT |
| `base64url` | 3.0.1 | MIT |
| `basic-auth` | 2.0.1 | MIT |
| `bcryptjs` | 2.4.3 | MIT |
| `bluebird` | 3.7.2 | MIT |
| `body-parser` | 1.20.6 | MIT |
| `brace-expansion` | 2.1.2 | MIT |
| `bson` | 6.10.4 | Apache-2.0 |
| `buffer` | 6.0.3 | MIT |
| `buffer-crc32` | 1.0.0 | MIT |
| `buffer-equal-constant-time` | 1.0.1 | BSD-3-Clause |
| `buffer-from` | 1.1.2 | MIT |
| `bull` | 4.16.5 | MIT |
| `busboy` | 1.6.0 | MIT |
| `bytes` | 3.1.2 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `call-bound` | 1.0.4 | MIT |
| `cluster-key-slot` | 1.1.1, 1.1.2 | Apache-2.0 |
| `color-convert` | 2.0.1 | MIT |
| `color-name` | 1.1.4 | MIT |
| `combined-stream` | 1.0.8 | MIT |
| `compress-commons` | 6.0.2 | MIT |
| `compressible` | 2.0.18 | MIT |
| `compression` | 1.8.1 | MIT |
| `concat-stream` | 2.0.0 | MIT |
| `content-disposition` | 0.5.4 | MIT |
| `content-type` | 1.0.5 | MIT |
| `cookie` | 0.7.2 | MIT |
| `cookie-signature` | 1.0.7 | MIT |
| `core-util-is` | 1.0.3 | MIT |
| `cors` | 2.8.6 | MIT |
| `crc-32` | 1.2.2 | Apache-2.0 |
| `crc32-stream` | 6.0.0 | MIT |
| `cron-parser` | 4.9.0 | MIT |
| `cross-spawn` | 7.0.6 | MIT |
| `debug` | 2.6.9, 4.4.3 | MIT |
| `delayed-stream` | 1.0.0 | MIT |
| `denque` | 2.1.0 | Apache-2.0 |
| `depd` | 2.0.0 | MIT |
| `destroy` | 1.2.0 | MIT |
| `detect-libc` | 2.1.2 | Apache-2.0 |
| `dotenv` | 16.6.1 | BSD-2-Clause |
| `dunder-proto` | 1.0.1 | MIT |
| `duplexer2` | 0.1.4 | BSD-3-Clause |
| `ecdsa-sig-formatter` | 1.0.11 | Apache-2.0 |
| `ee-first` | 1.1.1 | MIT |
| `emoji-regex` | 8.0.0 | MIT |
| `encodeurl` | 2.0.0 | MIT |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `es-set-tostringtag` | 2.1.0 | MIT |
| `escape-html` | 1.0.3 | MIT |
| `etag` | 1.8.1 | MIT |
| `event-target-shim` | 5.0.1 | MIT |
| `events` | 3.3.0 | MIT |
| `events-universal` | 1.0.1 | Apache-2.0 |
| `express` | 4.22.2 | MIT |
| `express-rate-limit` | 7.5.1 | MIT |
| `fast-fifo` | 1.3.2 | MIT |
| `finalhandler` | 1.3.2 | MIT |
| `follow-redirects` | 1.16.0 | MIT |
| `foreground-child` | 3.3.1 | ISC |
| `form-data` | 4.0.6 | MIT |
| `forwarded` | 0.2.0 | MIT |
| `fresh` | 0.5.2 | MIT |
| `fs-extra` | 11.3.1 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `generic-pool` | 3.9.0 | MIT |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-port` | 5.1.1 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `glob` | 10.5.0 | ISC |
| `gopd` | 1.2.0 | MIT |
| `graceful-fs` | 4.2.11 | ISC |
| `has-flag` | 3.0.0 | MIT |
| `has-symbols` | 1.1.0 | MIT |
| `has-tostringtag` | 1.0.2 | MIT |
| `hasown` | 2.0.4 | MIT |
| `helmet` | 7.2.0 | MIT |
| `http-errors` | 2.0.1 | MIT |
| `https-proxy-agent` | 5.0.1 | MIT |
| `iconv-lite` | 0.4.24 | MIT |
| `ieee754` | 1.2.1 | BSD-3-Clause |
| `inherits` | 2.0.4 | ISC |
| `ioredis` | 5.11.1 | MIT |
| `ipaddr.js` | 1.9.1 | MIT |
| `is-fullwidth-code-point` | 3.0.0 | MIT |
| `is-stream` | 2.0.1 | MIT |
| `isarray` | 1.0.0 | MIT |
| `isexe` | 2.0.0 | ISC |
| `jackspeak` | 3.4.3 | BlueOak-1.0.0 |
| `joi` | 18.2.3 | BSD-3-Clause |
| `jsonfile` | 6.2.1 | MIT |
| `jsonwebtoken` | 9.0.3 | MIT |
| `jwa` | 2.0.1 | MIT |
| `jws` | 4.0.1 | MIT |
| `kareem` | 2.6.3 | Apache-2.0 |
| `lazystream` | 1.0.1 | MIT |
| `lodash` | 4.18.1 | MIT |
| `lodash.includes` | 4.3.0 | MIT |
| `lodash.isboolean` | 3.0.3 | MIT |
| `lodash.isinteger` | 4.0.4 | MIT |
| `lodash.isnumber` | 3.0.3 | MIT |
| `lodash.isplainobject` | 4.0.6 | MIT |
| `lodash.isstring` | 4.0.1 | MIT |
| `lodash.once` | 4.1.1 | MIT |
| `lru-cache` | 10.4.3 | ISC |
| `luxon` | 3.7.2 | MIT |
| `math-intrinsics` | 1.1.0 | MIT |
| `media-typer` | 0.3.0 | MIT |
| `memory-pager` | 1.5.0 | MIT |
| `merge-descriptors` | 1.0.3 | MIT |
| `methods` | 1.1.2 | MIT |
| `mime` | 1.6.0 | MIT |
| `mime-db` | 1.52.0, 1.54.0 | MIT |
| `mime-types` | 2.1.35 | MIT |
| `minimatch` | 5.1.9, 9.0.9 | ISC |
| `minipass` | 7.1.3 | BlueOak-1.0.0 |
| `mongodb` | 6.20.0 | Apache-2.0 |
| `mongodb-connection-string-url` | 3.0.2 | Apache-2.0 |
| `mongoose` | 8.24.1 | MIT |
| `morgan` | 1.11.0 | MIT |
| `mpath` | 0.9.0 | MIT |
| `mquery` | 5.0.0 | MIT |
| `ms` | 2.0.0, 2.1.3 | MIT |
| `msgpackr` | 1.12.1 | MIT |
| `msgpackr-extract` | 3.0.4 | MIT |
| `multer` | 2.2.0 | MIT |
| `negotiator` | 0.6.3, 0.6.4 | MIT |
| `node-gyp-build-optional-packages` | 5.2.2 | MIT |
| `node-int64` | 0.4.0 | MIT |
| `nodemailer` | 9.0.3 | MIT-0 |
| `normalize-path` | 3.0.0 | MIT |
| `oauth` | 0.10.2 | MIT |
| `object-assign` | 4.1.1 | MIT |
| `object-inspect` | 1.13.4 | MIT |
| `on-finished` | 2.4.1 | MIT |
| `on-headers` | 1.1.0 | MIT |
| `package-json-from-dist` | 1.0.1 | BlueOak-1.0.0 |
| `parseurl` | 1.3.3 | MIT |
| `passport` | 0.7.0 | MIT |
| `passport-google-oauth20` | 2.0.0 | MIT |
| `passport-oauth2` | 1.8.0 | MIT |
| `passport-strategy` | 1.0.0 | MIT |
| `path-key` | 3.1.1 | MIT |
| `path-scurry` | 1.11.1 | BlueOak-1.0.0 |
| `path-to-regexp` | 0.1.13 | MIT |
| `pause` | 0.0.1 | Unknown |
| `process` | 0.11.10 | MIT |
| `process-nextick-args` | 2.0.1 | MIT |
| `proxy-addr` | 2.0.7 | MIT |
| `proxy-from-env` | 2.1.0 | MIT |
| `punycode` | 2.3.1 | MIT |
| `qs` | 6.15.3 | BSD-3-Clause |
| `range-parser` | 1.2.1 | MIT |
| `raw-body` | 2.5.3 | MIT |
| `readable-stream` | 2.3.8, 3.6.2, 4.7.0 | MIT |
| `readdir-glob` | 1.1.3 | Apache-2.0 |
| `redis` | 4.7.1 | MIT |
| `redis-errors` | 1.2.0 | MIT |
| `redis-parser` | 3.0.0 | MIT |
| `safe-buffer` | 5.1.2, 5.2.1 | MIT |
| `safer-buffer` | 2.1.2 | MIT |
| `semver` | 7.8.5 | ISC |
| `send` | 0.19.2 | MIT |
| `serve-static` | 1.16.3 | MIT |
| `setprototypeof` | 1.2.0 | ISC |
| `sharp` | 0.34.5 | Apache-2.0 |
| `shebang-command` | 2.0.0 | MIT |
| `shebang-regex` | 3.0.0 | MIT |
| `side-channel` | 1.1.1 | MIT |
| `side-channel-list` | 1.0.1 | MIT |
| `side-channel-map` | 1.0.1 | MIT |
| `side-channel-weakmap` | 1.0.2 | MIT |
| `sift` | 17.1.3 | MIT |
| `signal-exit` | 4.1.0 | ISC |
| `sparse-bitfield` | 3.0.3 | MIT |
| `standard-as-callback` | 2.1.0 | MIT |
| `statuses` | 2.0.2 | MIT |
| `streamsearch` | 1.1.0 | MIT |
| `streamx` | 2.28.0 | MIT |
| `string_decoder` | 1.1.1, 1.3.0 | MIT |
| `string-width` | 4.2.3 | MIT |
| `strip-ansi` | 6.0.1 | MIT |
| `supports-color` | 5.5.0 | MIT |
| `tar-stream` | 3.2.0 | MIT |
| `teex` | 1.0.1 | MIT |
| `text-decoder` | 1.2.7 | Apache-2.0 |
| `toidentifier` | 1.0.1 | MIT |
| `tr46` | 5.1.1 | MIT |
| `type-is` | 1.6.18 | MIT |
| `typedarray` | 0.0.6 | MIT |
| `uid2` | 0.0.4 | MIT |
| `universalify` | 2.0.1 | MIT |
| `unpipe` | 1.0.0 | MIT |
| `unzipper` | 0.12.5 | MIT |
| `util-deprecate` | 1.0.2 | MIT |
| `utils-merge` | 1.0.1 | MIT |
| `uuid` | 8.3.2, 11.1.1 | MIT |
| `vary` | 1.1.2 | MIT |
| `webidl-conversions` | 7.0.0 | BSD-2-Clause |
| `whatwg-url` | 14.2.0 | MIT |
| `which` | 2.0.2 | ISC |
| `wrap-ansi` | 7.0.0 | MIT |
| `ws` | 8.21.0 | MIT |
| `yallist` | 4.0.0 | ISC |
| `zip-stream` | 6.0.1 | MIT |

† 플랫폼별 바이너리 — 이 문서를 만든 환경 기준이다. 설치 환경에 따라 패키지 이름이 바뀐다.

## 웹 화면 (`frontend`)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| `@babel/code-frame` | 7.29.7 | MIT |
| `@babel/generator` | 7.29.7 | MIT |
| `@babel/helper-globals` | 7.29.7 | MIT |
| `@babel/helper-module-imports` | 7.29.7 | MIT |
| `@babel/helper-string-parser` | 7.29.7 | MIT |
| `@babel/helper-validator-identifier` | 7.29.7 | MIT |
| `@babel/parser` | 7.29.7 | MIT |
| `@babel/runtime` | 7.29.7 | MIT |
| `@babel/template` | 7.29.7 | MIT |
| `@babel/traverse` | 7.29.7 | MIT |
| `@babel/types` | 7.29.7 | MIT |
| `@emotion/babel-plugin` | 11.13.5 | MIT |
| `@emotion/cache` | 11.14.0 | MIT |
| `@emotion/hash` | 0.9.2 | MIT |
| `@emotion/is-prop-valid` | 1.4.0 | MIT |
| `@emotion/memoize` | 0.9.0 | MIT |
| `@emotion/react` | 11.14.0 | MIT |
| `@emotion/serialize` | 1.3.3 | MIT |
| `@emotion/sheet` | 1.4.0 | MIT |
| `@emotion/styled` | 11.14.1 | MIT |
| `@emotion/unitless` | 0.10.0 | MIT |
| `@emotion/use-insertion-effect-with-fallbacks` | 1.2.0 | MIT |
| `@emotion/utils` | 1.4.2 | MIT |
| `@emotion/weak-memoize` | 0.4.0 | MIT |
| `@hello-pangea/dnd` | 16.6.0 | Apache-2.0 |
| `@jridgewell/gen-mapping` | 0.3.13 | MIT |
| `@jridgewell/resolve-uri` | 3.1.2 | MIT |
| `@jridgewell/sourcemap-codec` | 1.5.5 | MIT |
| `@jridgewell/trace-mapping` | 0.3.31 | MIT |
| `@mui/core-downloads-tracker` | 5.18.0 | MIT |
| `@mui/icons-material` | 5.18.0 | MIT |
| `@mui/material` | 5.18.0 | MIT |
| `@mui/private-theming` | 5.17.1 | MIT |
| `@mui/styled-engine` | 5.18.0 | MIT |
| `@mui/system` | 5.18.0 | MIT |
| `@mui/types` | 7.2.24 | MIT |
| `@mui/utils` | 5.17.1 | MIT |
| `@popperjs/core` | 2.11.8 | MIT |
| `@remix-run/router` | 1.23.3 | MIT |
| `@tanstack/query-core` | 5.101.2 | MIT |
| `@tanstack/react-query` | 5.101.2 | MIT |
| `@types/debug` | 4.1.13 | MIT |
| `@types/estree` | 1.0.9 | MIT |
| `@types/estree-jsx` | 1.0.5 | MIT |
| `@types/hast` | 3.0.5 | MIT |
| `@types/hoist-non-react-statics` | 3.3.7 | MIT |
| `@types/mdast` | 4.0.4 | MIT |
| `@types/ms` | 2.1.0 | MIT |
| `@types/parse-json` | 4.0.2 | MIT |
| `@types/prop-types` | 15.7.15 | MIT |
| `@types/react` | 18.3.27 | MIT |
| `@types/react-dom` | 18.3.7 | MIT |
| `@types/react-transition-group` | 4.4.12 | MIT |
| `@types/trusted-types` | 2.0.7 | MIT |
| `@types/unist` | 2.0.11, 3.0.3 | MIT |
| `@types/use-sync-external-store` | 0.0.3 | MIT |
| `@ungap/structured-clone` | 1.3.3 | ISC |
| `agent-base` | 6.0.2 | MIT |
| `asynckit` | 0.4.0 | MIT |
| `attr-accept` | 2.2.5 | MIT |
| `axios` | 1.18.1 | MIT |
| `babel-plugin-macros` | 3.1.0 | MIT |
| `bail` | 2.0.2 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `callsites` | 3.1.0 | MIT |
| `ccount` | 2.0.1 | MIT |
| `character-entities` | 2.0.2 | MIT |
| `character-entities-html4` | 2.1.0 | MIT |
| `character-entities-legacy` | 3.0.0 | MIT |
| `character-reference-invalid` | 2.0.1 | MIT |
| `clsx` | 2.1.1 | MIT |
| `combined-stream` | 1.0.8 | MIT |
| `comma-separated-tokens` | 2.0.3 | MIT |
| `convert-source-map` | 1.9.0 | MIT |
| `cosmiconfig` | 7.1.0 | MIT |
| `css-box-model` | 1.2.1 | MIT |
| `csstype` | 3.2.3 | MIT |
| `date-fns` | 3.6.0 | MIT |
| `debug` | 4.4.3 | MIT |
| `decode-named-character-reference` | 1.3.0 | MIT |
| `delayed-stream` | 1.0.0 | MIT |
| `dequal` | 2.0.3 | MIT |
| `devlop` | 1.1.0 | MIT |
| `dom-helpers` | 5.2.1 | MIT |
| `dompurify` | 3.4.11 | (MPL-2.0 OR Apache-2.0) |
| `dunder-proto` | 1.0.1 | MIT |
| `error-ex` | 1.3.4 | MIT |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `es-set-tostringtag` | 2.1.0 | MIT |
| `escape-string-regexp` | 4.0.0 | MIT |
| `estree-util-is-identifier-name` | 3.0.0 | MIT |
| `extend` | 3.0.2 | MIT |
| `file-selector` | 2.1.2 | MIT |
| `find-root` | 1.1.0 | MIT |
| `follow-redirects` | 1.16.0 | MIT |
| `form-data` | 4.0.6 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `goober` | 2.1.19 | MIT |
| `gopd` | 1.2.0 | MIT |
| `has-flag` | 4.0.0 | MIT |
| `has-symbols` | 1.1.0 | MIT |
| `has-tostringtag` | 1.0.2 | MIT |
| `hasown` | 2.0.4 | MIT |
| `hast-util-to-jsx-runtime` | 2.3.6 | MIT |
| `hast-util-whitespace` | 3.0.0 | MIT |
| `hoist-non-react-statics` | 3.3.2 | BSD-3-Clause |
| `html-url-attributes` | 3.0.1 | MIT |
| `https-proxy-agent` | 5.0.1 | MIT |
| `import-fresh` | 3.3.1 | MIT |
| `inline-style-parser` | 0.2.7 | MIT |
| `is-alphabetical` | 2.0.1 | MIT |
| `is-alphanumerical` | 2.0.1 | MIT |
| `is-arrayish` | 0.2.1 | MIT |
| `is-core-module` | 2.16.2 | MIT |
| `is-decimal` | 2.0.1 | MIT |
| `is-hexadecimal` | 2.0.1 | MIT |
| `is-plain-obj` | 4.1.0 | MIT |
| `js-cookie` | 3.0.8 | MIT |
| `js-tokens` | 4.0.0 | MIT |
| `jsesc` | 3.1.0 | MIT |
| `json-parse-even-better-errors` | 2.3.1 | MIT |
| `lines-and-columns` | 1.2.4 | MIT |
| `longest-streak` | 3.1.0 | MIT |
| `loose-envify` | 1.4.0 | MIT |
| `math-intrinsics` | 1.1.0 | MIT |
| `mdast-util-from-markdown` | 2.0.3 | MIT |
| `mdast-util-mdx-expression` | 2.0.1 | MIT |
| `mdast-util-mdx-jsx` | 3.2.0 | MIT |
| `mdast-util-mdxjs-esm` | 2.0.1 | MIT |
| `mdast-util-phrasing` | 4.1.0 | MIT |
| `mdast-util-to-hast` | 13.2.1 | MIT |
| `mdast-util-to-markdown` | 2.1.2 | MIT |
| `mdast-util-to-string` | 4.0.0 | MIT |
| `memoize-one` | 6.0.0 | MIT |
| `micromark` | 4.0.2 | MIT |
| `micromark-core-commonmark` | 2.0.3 | MIT |
| `micromark-factory-destination` | 2.0.1 | MIT |
| `micromark-factory-label` | 2.0.1 | MIT |
| `micromark-factory-space` | 2.0.1 | MIT |
| `micromark-factory-title` | 2.0.1 | MIT |
| `micromark-factory-whitespace` | 2.0.1 | MIT |
| `micromark-util-character` | 2.1.1 | MIT |
| `micromark-util-chunked` | 2.0.1 | MIT |
| `micromark-util-classify-character` | 2.0.1 | MIT |
| `micromark-util-combine-extensions` | 2.0.1 | MIT |
| `micromark-util-decode-numeric-character-reference` | 2.0.2 | MIT |
| `micromark-util-decode-string` | 2.0.1 | MIT |
| `micromark-util-encode` | 2.0.1 | MIT |
| `micromark-util-html-tag-name` | 2.0.1 | MIT |
| `micromark-util-normalize-identifier` | 2.0.1 | MIT |
| `micromark-util-resolve-all` | 2.0.1 | MIT |
| `micromark-util-sanitize-uri` | 2.0.1 | MIT |
| `micromark-util-subtokenize` | 2.1.0 | MIT |
| `micromark-util-symbol` | 2.0.1 | MIT |
| `micromark-util-types` | 2.0.2 | MIT |
| `mime-db` | 1.52.0 | MIT |
| `mime-types` | 2.1.35 | MIT |
| `ms` | 2.1.3 | MIT |
| `object-assign` | 4.1.1 | MIT |
| `parent-module` | 1.0.1 | MIT |
| `parse-entities` | 4.0.2 | MIT |
| `parse-json` | 5.2.0 | MIT |
| `path-parse` | 1.0.7 | MIT |
| `path-type` | 4.0.0 | MIT |
| `picocolors` | 1.1.1 | ISC |
| `prop-types` | 15.8.1 | MIT |
| `property-information` | 7.2.0 | MIT |
| `proxy-from-env` | 2.1.0 | MIT |
| `raf-schd` | 4.0.3 | MIT |
| `react` | 18.3.1 | MIT |
| `react-dom` | 18.3.1 | MIT |
| `react-dropzone` | 14.4.1 | MIT |
| `react-hook-form` | 7.81.0 | MIT |
| `react-hot-toast` | 2.6.0 | MIT |
| `react-is` | 16.13.1, 18.3.1, 19.2.7 | MIT |
| `react-markdown` | 10.1.0 | MIT |
| `react-redux` | 8.1.3 | MIT |
| `react-router` | 6.30.4 | MIT |
| `react-router-dom` | 6.30.4 | MIT |
| `react-transition-group` | 4.4.5 | BSD-3-Clause |
| `redux` | 4.2.1 | MIT |
| `remark-parse` | 11.0.0 | MIT |
| `remark-rehype` | 11.1.2 | MIT |
| `resolve` | 1.22.12 | MIT |
| `resolve-from` | 4.0.0 | MIT |
| `scheduler` | 0.23.2 | MIT |
| `source-map` | 0.5.7 | BSD-3-Clause |
| `space-separated-tokens` | 2.0.2 | MIT |
| `stringify-entities` | 4.0.4 | MIT |
| `style-to-js` | 1.1.21 | MIT |
| `style-to-object` | 1.0.14 | MIT |
| `stylis` | 4.2.0 | MIT |
| `supports-color` | 7.2.0 | MIT |
| `supports-preserve-symlinks-flag` | 1.0.0 | MIT |
| `tiny-invariant` | 1.3.3 | MIT |
| `trim-lines` | 3.0.1 | MIT |
| `trough` | 2.2.0 | MIT |
| `tslib` | 2.8.1 | 0BSD |
| `unified` | 11.0.5 | MIT |
| `unist-util-is` | 6.0.1 | MIT |
| `unist-util-position` | 5.0.0 | MIT |
| `unist-util-stringify-position` | 4.0.0 | MIT |
| `unist-util-visit` | 5.1.0 | MIT |
| `unist-util-visit-parents` | 6.0.2 | MIT |
| `use-memo-one` | 1.1.3 | MIT |
| `use-sync-external-store` | 1.6.0 | MIT |
| `vfile` | 6.0.3 | MIT |
| `vfile-message` | 4.0.3 | MIT |
| `yaml` | 1.10.3 | ISC |
| `zwitch` | 2.0.4 | MIT |

## MCP 서버 (`mcp-server`)

| 패키지 | 버전 | 라이선스 |
|---|---|---|
| `@hono/node-server` | 1.19.14 | MIT |
| `@modelcontextprotocol/sdk` | 1.29.0 | MIT |
| `accepts` | 2.0.0 | MIT |
| `ajv` | 8.20.0 | MIT |
| `ajv-formats` | 3.0.1 | MIT |
| `body-parser` | 2.3.0 | MIT |
| `bytes` | 3.1.2 | MIT |
| `call-bind-apply-helpers` | 1.0.2 | MIT |
| `call-bound` | 1.0.4 | MIT |
| `content-disposition` | 1.1.0 | MIT |
| `content-type` | 1.0.5, 2.0.0 | MIT |
| `cookie` | 0.7.2 | MIT |
| `cookie-signature` | 1.2.2 | MIT |
| `cors` | 2.8.6 | MIT |
| `cross-spawn` | 7.0.6 | MIT |
| `debug` | 4.4.3 | MIT |
| `depd` | 2.0.0 | MIT |
| `dunder-proto` | 1.0.1 | MIT |
| `ee-first` | 1.1.1 | MIT |
| `encodeurl` | 2.0.0 | MIT |
| `es-define-property` | 1.0.1 | MIT |
| `es-errors` | 1.3.0 | MIT |
| `es-object-atoms` | 1.1.2 | MIT |
| `escape-html` | 1.0.3 | MIT |
| `etag` | 1.8.1 | MIT |
| `eventsource` | 3.0.7 | MIT |
| `eventsource-parser` | 3.1.0 | MIT |
| `express` | 5.2.1 | MIT |
| `express-rate-limit` | 8.5.2 | MIT |
| `fast-deep-equal` | 3.1.3 | MIT |
| `fast-uri` | 3.1.3 | BSD-3-Clause |
| `finalhandler` | 2.1.1 | MIT |
| `forwarded` | 0.2.0 | MIT |
| `fresh` | 2.0.0 | MIT |
| `function-bind` | 1.1.2 | MIT |
| `get-intrinsic` | 1.3.0 | MIT |
| `get-proto` | 1.0.1 | MIT |
| `gopd` | 1.2.0 | MIT |
| `has-symbols` | 1.1.0 | MIT |
| `hasown` | 2.0.4 | MIT |
| `hono` | 4.12.29 | MIT |
| `http-errors` | 2.0.1 | MIT |
| `iconv-lite` | 0.7.3 | MIT |
| `inherits` | 2.0.4 | ISC |
| `ip-address` | 10.2.0 | MIT |
| `ipaddr.js` | 1.9.1 | MIT |
| `is-promise` | 4.0.0 | MIT |
| `isexe` | 2.0.0 | ISC |
| `jose` | 6.2.3 | MIT |
| `json-schema-traverse` | 1.0.0 | MIT |
| `json-schema-typed` | 8.0.2 | BSD-2-Clause |
| `math-intrinsics` | 1.1.0 | MIT |
| `media-typer` | 1.1.0 | MIT |
| `merge-descriptors` | 2.0.0 | MIT |
| `mime-db` | 1.54.0 | MIT |
| `mime-types` | 3.0.2 | MIT |
| `ms` | 2.1.3 | MIT |
| `negotiator` | 1.0.0 | MIT |
| `object-assign` | 4.1.1 | MIT |
| `object-inspect` | 1.13.4 | MIT |
| `on-finished` | 2.4.1 | MIT |
| `once` | 1.4.0 | ISC |
| `parseurl` | 1.3.3 | MIT |
| `path-key` | 3.1.1 | MIT |
| `path-to-regexp` | 8.4.2 | MIT |
| `pkce-challenge` | 5.0.1 | MIT |
| `proxy-addr` | 2.0.7 | MIT |
| `qs` | 6.15.3 | BSD-3-Clause |
| `range-parser` | 1.3.0 | MIT |
| `raw-body` | 3.0.2 | MIT |
| `require-from-string` | 2.0.2 | MIT |
| `router` | 2.2.0 | MIT |
| `safer-buffer` | 2.1.2 | MIT |
| `send` | 1.2.1 | MIT |
| `serve-static` | 2.2.1 | MIT |
| `setprototypeof` | 1.2.0 | ISC |
| `shebang-command` | 2.0.0 | MIT |
| `shebang-regex` | 3.0.0 | MIT |
| `side-channel` | 1.1.1 | MIT |
| `side-channel-list` | 1.0.1 | MIT |
| `side-channel-map` | 1.0.1 | MIT |
| `side-channel-weakmap` | 1.0.2 | MIT |
| `statuses` | 2.0.2 | MIT |
| `toidentifier` | 1.0.1 | MIT |
| `type-is` | 2.1.0 | MIT |
| `unpipe` | 1.0.0 | MIT |
| `vary` | 1.1.2 | MIT |
| `which` | 2.0.2 | ISC |
| `wrappy` | 1.0.2 | ISC |
| `zod` | 3.25.76 | MIT |
| `zod-to-json-schema` | 3.25.2 | ISC |
