# VCC Manager API Documentation

이 문서는 VCC Manager의 REST API 엔드포인트를 설명합니다.
모든 API 요청의 기본 URL은 `/api` 입니다. (예: `http://localhost/api/auth/status`)

## 🔐 인증 (Auth)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/auth/google` | 구글 OAuth 로그인 시작 | No |
| `GET` | `/auth/google/callback` | 구글 OAuth 콜백 | No |
| `GET` | `/auth/me` | 현재 로그인한 사용자 정보 조회 | Yes |
| `POST` | `/auth/logout` | 로그아웃 | Yes |
| `POST` | `/auth/signup` | 이메일/비밀번호 회원가입 | No |
| `POST` | `/auth/signin` | 이메일/비밀번호 로그인 | No |
| `GET` | `/auth/check-email/:email` | 이메일 중복 확인 | No |
| `GET` | `/auth/check-nickname/:nickname` | 닉네임 중복 확인 | No |
| `GET` | `/auth/status` | 인증 상태 확인 (Health check) | No |

## 👤 사용자 (Users)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/users/profile` | 내 프로필 상세 정보 조회 | Yes |
| `PUT` | `/users/profile` | 내 프로필 수정 (닉네임, 설정 등) | Yes |
| `GET` | `/users/stats` | 내 활동 통계 (작업 수, 이미지 수 등) | Yes |
| `DELETE` | `/users/account` | 회원 탈퇴 | Yes |

## 📋 작업판 (Workboards)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/workboards` | 활성화된 작업판 목록 조회 (페이징, 검색) | Yes |
| `GET` | `/workboards/:id` | 작업판 상세 정보 조회 | Yes |
| `GET` | `/workboards/admin/:id` | (관리자) 작업판 상세 조회 (Workflow 데이터 포함) | **Admin** |
| `POST` | `/workboards` | (관리자) 새 작업판 생성 | **Admin** |
| `PUT` | `/workboards/:id` | (관리자) 작업판 수정 | **Admin** |
| `DELETE` | `/workboards/:id` | (관리자) 작업판 비활성화 (삭제) | **Admin** |
| `POST` | `/workboards/:id/duplicate` | (관리자) 작업판 복제 | **Admin** |
| `GET` | `/workboards/:id/stats` | (관리자) 작업판별 사용 통계 조회 | **Admin** |

## 🎨 이미지 생성 작업 (Jobs)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `POST` | `/jobs/generate` | 이미지 생성 요청 | Yes |
| `GET` | `/jobs/my` | 내 작업 목록 조회 | Yes |
| `GET` | `/jobs/:id` | 작업 상세 정보 조회 | Yes |
| `DELETE` | `/jobs/:id` | 작업 기록 삭제 | Yes |
| `POST` | `/jobs/:id/retry` | 실패한 작업 재시도 | Yes |
| `POST` | `/jobs/:id/cancel` | 대기/진행 중인 작업 취소 | Yes |
| `GET` | `/jobs/queue/stats` | 전체 큐 상태 조회 (대기열 수 등) | Yes |

### Job 생성 Request Body 예시
```json
{
  "workboardId": "...",
  "prompt": "a beautiful landscape",
  "aiModel": { "key": "model_name", "value": "model_path.safetensors" },
  "imageSize": { "key": "1024x1024", "value": "1024x1024" },
  "seed": 12345,
  "additionalParams": {
    "steps": 30,
    "cfg": 7
  }
}
```

## 🖼️ 이미지 관리 (Images)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `POST` | `/images/upload` | 레퍼런스 이미지 업로드 (Multipart/form-data) | Yes |
| `GET` | `/images/uploaded` | 업로드한 이미지 목록 조회 | Yes |
| `GET` | `/images/generated` | 생성된 이미지 목록 조회 | Yes |
| `GET` | `/images/uploaded/:id` | 업로드 이미지 상세 조회 | Yes |
| `GET` | `/images/generated/:id` | 생성 이미지 상세 조회 | Yes |
| `PUT` | `/images/uploaded/:id` | 업로드 이미지 정보 수정 (태그 등) | Yes |
| `PUT` | `/images/generated/:id` | 생성 이미지 정보 수정 (공개 여부 등) | Yes |
| `DELETE` | `/images/uploaded/:id` | 업로드 이미지 삭제 | Yes |
| `DELETE` | `/images/generated/:id` | 생성 이미지 삭제 | Yes |
| `GET` | `/images/stats` | 이미지 통계 조회 | Yes |
| `POST` | `/images/generated/:id/download` | 생성된 이미지 다운로드 | Yes |

## 👑 관리자 (Admin)

| Method | Endpoint | Description | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/admin/users` | 전체 사용자 목록 조회 | **Admin** |
| `DELETE` | `/admin/users/:id` | 사용자 강제 탈퇴 및 데이터 삭제 | **Admin** |
| `GET` | `/admin/stats` | 전체 시스템 통합 통계 조회 | **Admin** |
| `GET` | `/admin/jobs` | 전체 작업 목록 조회 | **Admin** |
