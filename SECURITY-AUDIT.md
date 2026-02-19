# SECURITY AUDIT

- Project: `vcc-manager`
- Audit date: 2026-02-19
- Method: Static code review (backend/frontend/mcp), secret pattern scan, dependency audit attempt
- Scope: `src/`, `frontend/`, `mcp-server/`, compose/config files

## Executive Summary

이번 점검에서 즉시 보완이 필요한 주요 이슈를 확인했습니다.

1. Signed file URL 발급/검증 로직의 경로 검증 미흡으로 인한 임의 파일 접근 가능성
2. 복구 API의 `filePath` 신뢰로 인한 임의 파일 삭제 가능성(관리자 권한 경로)
3. 외부 메타데이터 HTML을 sanitize 없이 렌더링하는 저장형/반사형 XSS 위험
4. 세션 기반 인증 경로에 대한 CSRF 방어 부재
5. 약한 기본 시크릿 폴백/운영 오동작 시 보안 약화 가능성

또한 의존성 취약점은 네트워크 제한으로 온라인 DB 조회형 `npm audit`를 수행하지 못했습니다.

## Findings

### F-01 (High) Signed URL 경로 검증 우회 및 파일 접근 통제 미흡
- Category: 파일 접근/경로 조작, 인증/인가
- Evidence:
  - `src/routes/files.js:27` `uploadPath`는 `startsWith('/uploads/')`만 검사
  - `src/routes/files.js:61` `path.resolve(UPLOAD_ROOT, '.' + filePath)` 사용
  - `src/routes/files.js:64` `absolutePath.startsWith(resolvedRoot)` 비교만 사용
  - `src/routes/files.js:32` 요청자가 지정한 경로로 바로 signed URL 생성
- Risk:
  - `..` 세그먼트/경계 케이스를 충분히 정규화하지 않아 루트 경계 우회 가능성이 있습니다.
  - `/api/files/sign`에서 파일 소유권/테넌트 검증이 없어, 인증된 사용자가 다른 사용자 파일 경로를 알면 signed URL을 발급받을 수 있습니다(IDOR).
- Recommendation:
  - `path.normalize` 후 `..`, null-byte, 이중 인코딩을 차단하고 allowlist 서브디렉토리(`generated|reference|videos`)만 허용.
  - 경로 검증은 `path.relative(resolvedRoot, absolutePath)` 기반으로 수행(`..` 또는 absolute면 차단).
  - `/sign`에서 해당 파일이 `req.user` 소유인지 DB 조회로 검증.

### F-02 (High) 복구 API에서 사용자 입력 `filePath` 신뢰로 임의 파일 삭제 가능
- Category: 파일 접근/경로 조작
- Evidence:
  - `src/routes/backup.js:276` `filePath`를 요청 본문에서 수신
  - `src/routes/backup.js:295` `restoreService.executeRestore(jobId, filePath, options)` 호출
  - `src/routes/backup.js:298`, `src/routes/backup.js:304` `fs.unlinkSync(filePath)` 실행
- Risk:
  - 관리자 세션/토큰이 탈취되거나 CSRF와 결합될 경우, 서버 권한 범위 내 임의 파일 삭제로 이어질 수 있습니다.
- Recommendation:
  - `restore/validate`에서 발급한 서버측 토큰(jobId↔temp path mapping)만 사용하고 클라이언트가 파일 경로를 직접 전달하지 못하게 변경.
  - 삭제 대상은 전용 임시 디렉토리 하위인지 `realpath`/`relative`로 강제 검증.

### F-03 (High) 외부 HTML sanitize 없이 `dangerouslySetInnerHTML` 렌더링
- Category: XSS
- Evidence:
  - `src/services/loraMetadataService.js:136` 외부(Civitai) `description` 저장
  - `frontend/src/pages/LoraList.js:236`
  - `frontend/src/pages/admin/LoraManagementPage.js:195`
  - `frontend/src/components/LoraListModal.js:748`
- Risk:
  - 외부 설명 필드에 악성 HTML/스크립트가 포함되면 관리자/사용자 브라우저에서 스크립트 실행 가능.
- Recommendation:
  - 서버 또는 클라이언트에서 DOMPurify 등으로 sanitize 후 렌더링.
  - 가능하면 plain text 렌더링으로 전환.

### F-04 (Medium) 세션 기반 인증 경로에 CSRF 보호 부재
- Category: CSRF, 인증/인가
- Evidence:
  - `src/server.js:92-99` 토큰 없으면 세션 인증 경로로 계속 진행
  - `src/middleware/auth.js:6-9` `req.isAuthenticated()/req.user` 기반 인증 허용
  - 상태 변경 API 예시: `src/routes/users.js:118` (`DELETE /users/account`)
- Risk:
  - 세션 로그인 사용자(특히 OAuth 사용) 대상 교차 사이트 요청 위조 가능성.
- Recommendation:
  - CSRF 토큰(`csurf`) 또는 SameSite=strict + Origin/Referer 검증 + 상태 변경 엔드포인트 재인증 적용.
  - 세션 기반 API와 Bearer API를 분리해 정책을 명확화.

### F-05 (Medium) OAuth 콜백에서 JWT를 URL query로 전달
- Category: 인증/토큰 관리
- Evidence:
  - `src/routes/auth.js:48` `.../auth/callback?token=${token}`
  - `frontend/src/pages/AuthCallback.js:13` query에서 token 추출
- Risk:
  - URL/로그/리퍼러/브라우저 히스토리를 통한 토큰 노출 가능성.
- Recommendation:
  - 토큰을 URL fragment(`#token=`) 또는 one-time code 교환 방식으로 변경.
  - 가능하면 서버가 HttpOnly/Secure 쿠키로 직접 설정.

### F-06 (Medium) 약한 기본 secret/fallback 값 존재
- Category: 하드코딩 시크릿/보안 설정
- Evidence:
  - `src/server.js:61` `SESSION_SECRET || 'your-secret-key'`
  - `src/utils/signedUrl.js:3` `JWT_SECRET || 'default-secret'`
  - `docker-compose.yml:9,24,42,43` 기본 비밀번호(`password`, `redispassword`) 폴백
  - `docker-compose.prod.yml:8,23,47,48` 동일 폴백
- Risk:
  - 운영 설정 누락 시 예측 가능한 비밀값으로 인증/서명 강도가 크게 저하.
- Recommendation:
  - 부팅 시 필수 시크릿 미설정이면 즉시 종료(fail-fast).
  - 운영 compose에서 insecure default 제거.

### F-07 (Low) 민감 입력 로그 노출 위험
- Category: 기타 보안 우려사항
- Evidence:
  - `src/utils/validation.js:102` 요청 본문 전체 로그(`password` 포함 가능)
- Risk:
  - 로그 수집 시스템/콘솔을 통해 평문 민감정보 노출 가능.
- Recommendation:
  - 민감 필드 마스킹 후 로그, 또는 검증 실패 시 필드명/에러코드만 기록.

### F-08 (Low) 사용자 입력 기반 정규식 사용으로 ReDoS 가능성
- Category: 웹 취약점(DoS)
- Evidence:
  - `src/routes/images.js:178,189,361,401` `new RegExp(search, 'i')`/`$regex: search`
- Risk:
  - 악의적 정규식 패턴으로 DB/앱 자원 소모 유발 가능.
- Recommendation:
  - 사용자 입력은 escape 후 literal 검색으로 변환.
  - 검색 길이 제한 및 요청 rate limit 강화.

## Requested Items Check

1. 하드코딩된 시크릿/API 키/토큰
- 실제 비밀값(실키) 하드코딩은 발견하지 못함.
- 다만 약한 기본값 폴백(F-06)이 존재.

2. SQL injection, XSS, CSRF
- SQLi: 본 프로젝트는 MongoDB 기반이며 전형적 SQLi 패턴은 미발견.
- XSS: `dangerouslySetInnerHTML` 경로에서 고위험(F-03).
- CSRF: 세션 경로 보호 미흡(F-04).

3. 인증/인가 로직 허점
- Signed URL 발급의 소유권 검증 부재(F-01).
- OAuth 토큰 전달 방식 위험(F-05).

4. 의존성 취약점
- `npm audit` 실행 실패(네트워크 DNS 차단).
  - root/frontend/mcp-server 모두 `getaddrinfo ENOTFOUND registry.npmjs.org`.

5. 파일 접근/경로 조작
- Signed URL 경로 검증 약점(F-01).
- 복구 경로 기반 파일 삭제(F-02).

6. 기타 보안 우려
- 민감정보 로그(F-07).
- 정규식 DoS 가능성(F-08).

## Dependency Audit Limitation

현재 환경에서 외부 네트워크가 차단되어 `npm audit` 온라인 취약점 DB 조회가 불가능했습니다.

실행 결과(3개 워크스페이스 공통):
- `request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed`
- `getaddrinfo ENOTFOUND registry.npmjs.org`

네트워크 가능한 환경에서 아래 재실행이 필요합니다.
- `npm audit --package-lock-only`
- `cd frontend && npm audit --package-lock-only`
- `cd mcp-server && npm audit --package-lock-only`

## Priority Remediation Order

1. F-01, F-02, F-03 즉시 수정 (파일 접근 통제/XSS)
2. F-04, F-05 인증 경계 강화 (CSRF/토큰 전달)
3. F-06 운영 설정 fail-fast 적용
4. F-07, F-08 하드닝
