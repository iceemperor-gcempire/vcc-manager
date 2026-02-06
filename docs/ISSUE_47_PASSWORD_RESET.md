# Issue #47: 비밀번호 재설정 기능 구현

## 작업 상태: 구현 완료 (커밋 전)

**작업일**: 2026-02-06
**브랜치**: `dev/v1.2`

---

## 1. 구현 완료된 파일

### 신규 파일
| 파일 | 설명 |
|------|------|
| `src/services/emailService.js` | 이메일 발송 서비스 (nodemailer + SMTP) |
| `frontend/src/pages/ForgotPassword.js` | 비밀번호 찾기 페이지 |
| `frontend/src/pages/ResetPassword.js` | 비밀번호 재설정 페이지 |

### 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `package.json` | nodemailer 패키지 추가 |
| `.env.example` | SMTP 환경변수 추가 |
| `src/models/User.js` | passwordResetToken, passwordResetExpires 필드 및 메서드 추가 |
| `src/routes/auth.js` | forgot-password, verify-reset-token, reset-password 엔드포인트 추가 |
| `frontend/src/services/api.js` | requestPasswordReset, verifyResetToken, resetPassword 메서드 추가 |
| `frontend/src/pages/Login.js` | "비밀번호를 잊으셨나요?" 링크 추가 |
| `frontend/src/App.js` | /forgot-password, /reset-password/:token 라우트 추가 |

---

## 2. 남은 작업

### 2.1 SMTP 환경변수 설정 (필수)
`.env` 파일에 다음 설정 추가:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourservice.com
SMTP_FROM_NAME=VCC Manager
```

**Gmail 사용 시**:
1. 2단계 인증 활성화
2. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
3. 생성된 16자리 비밀번호를 `SMTP_PASSWORD`에 입력

### 2.2 커밋 및 푸시
```bash
# 변경사항 확인
git status

# 파일 추가
git add package.json .env.example \
  src/services/emailService.js \
  src/models/User.js \
  src/routes/auth.js \
  frontend/src/services/api.js \
  frontend/src/pages/ForgotPassword.js \
  frontend/src/pages/ResetPassword.js \
  frontend/src/pages/Login.js \
  frontend/src/App.js

# 커밋
git commit -m "feat: add password reset functionality (#47)

- Add nodemailer for email sending
- Add password reset token fields to User model
- Add forgot-password, verify-reset-token, reset-password endpoints
- Add ForgotPassword and ResetPassword pages
- Add forgot password link to Login page

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 푸시
git push origin dev/v1.2
```

### 2.3 테스트
```bash
# Docker로 서비스 재시작
docker-compose down && docker-compose up --build -d

# 로그 확인
docker-compose logs -f backend
```

**테스트 시나리오**:
1. 로그인 페이지에서 "비밀번호를 잊으셨나요?" 클릭
2. 이메일 입력 후 발송 요청
3. 이메일 수신 확인
4. 링크 클릭 → 재설정 페이지 표시
5. 새 비밀번호 입력 → 변경 완료
6. 새 비밀번호로 로그인

### 2.4 PR 생성 (선택)
```bash
gh pr create --title "feat: add password reset functionality (#47)" --body "$(cat <<'EOF'
## Summary
- 비밀번호 분실 시 이메일을 통한 비밀번호 재설정 기능 추가
- nodemailer + SMTP 방식 사용
- Rate limiting 적용 (시간당 3회)

## Changes
- 백엔드: emailService, User 모델, auth 라우트 추가
- 프론트엔드: ForgotPassword, ResetPassword 페이지 추가

## Test plan
- [ ] SMTP 환경변수 설정
- [ ] 비밀번호 찾기 이메일 발송 테스트
- [ ] 재설정 링크 클릭 → 새 비밀번호 설정
- [ ] 변경된 비밀번호로 로그인

Closes #47

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 3. API 엔드포인트

| 엔드포인트 | 메서드 | 설명 | Rate Limit |
|------------|--------|------|------------|
| `/auth/forgot-password` | POST | 재설정 이메일 발송 | 3회/시간 |
| `/auth/verify-reset-token/:token` | GET | 토큰 유효성 검증 | - |
| `/auth/reset-password` | POST | 비밀번호 변경 | - |

---

## 4. 보안 기능

- **토큰 해싱**: SHA-256으로 해시하여 DB에 저장
- **만료 시간**: 1시간
- **1회용**: 사용 후 즉시 무효화
- **Rate Limiting**: forgot-password 엔드포인트 시간당 3회 제한
- **이메일 열거 방지**: 존재 여부와 관계없이 동일 메시지 반환

---

## 5. 프론트엔드 라우트

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/forgot-password` | ForgotPassword | 이메일 입력 폼 |
| `/reset-password/:token` | ResetPassword | 새 비밀번호 설정 폼 |

---

## 6. 참고사항

- Google OAuth 사용자는 비밀번호 재설정 불가 (local auth만 지원)
- 비밀번호 강도 검증: Signup 페이지와 동일한 규칙 적용
- 이메일 템플릿: HTML + 텍스트 버전 모두 지원
