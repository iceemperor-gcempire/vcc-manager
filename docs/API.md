# VCC Manager API Documentation

VCC Manager 의 REST API 엔드포인트 목록. 모든 요청의 기본 URL 은 `/api` (예: `http://localhost/api/auth/status`).

인증은 JWT 쿠키 또는 `X-API-Key` / `Authorization: Bearer <api_key>` 헤더 지원. 자세한 인증 정책은 root [CLAUDE.md](../../CLAUDE.md) 참고.

## 인증 (Auth)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/auth/google` | Google OAuth 시작 | - |
| `GET` | `/auth/google/callback` | Google OAuth 콜백 (토큰 fragment 반환) | - |
| `GET` | `/auth/me` | 현재 사용자 정보 | Yes |
| `POST` | `/auth/logout` | 로그아웃 | - |
| `POST` | `/auth/signup` | 이메일/비밀번호 회원가입 | - |
| `POST` | `/auth/signin` | 이메일/비밀번호 로그인 | - |
| `GET` | `/auth/check-email/:email` | 이메일 중복 확인 | - |
| `GET` | `/auth/check-nickname/:nickname` | 닉네임 중복 확인 | - |
| `GET` | `/auth/status` | Health check | - |
| `POST` | `/auth/forgot-password` | 비밀번호 재설정 이메일 발송 | - |
| `GET` | `/auth/verify-reset-token/:token` | 재설정 토큰 검증 | - |
| `POST` | `/auth/reset-password` | 비밀번호 재설정 실행 | - |

## 사용자 (Users)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/users/profile` | 내 프로필 상세 | Yes |
| `PUT` | `/users/profile` | 내 프로필 수정 (닉네임 / `preferences`) | Yes |
| `GET` | `/users/stats` | 내 활동 통계 | Yes |
| `DELETE` | `/users/account` | 회원 탈퇴 | Yes |

## API Key

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/apikeys` | 내 API Key 목록 | Yes |
| `POST` | `/apikeys` | API Key 발급 (사용자당 최대 10개) | Yes |
| `DELETE` | `/apikeys/:id` | API Key 폐기 | Yes |

## 서버 (Servers, v1.2.4+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/servers` | 활성 서버 목록 | Yes |
| `GET` | `/servers/:id` | 서버 상세 | **Admin** |
| `POST` | `/servers` | 서버 등록 (`serverType`: `OpenAI` / `OpenAI Compatible` / `Gemini` / `ComfyUI`) | **Admin** |
| `PUT` | `/servers/:id` | 서버 수정 | **Admin** |
| `DELETE` | `/servers/:id` | 서버 삭제 | **Admin** |
| `POST` | `/servers/:id/health-check` | 단일 서버 헬스체크 | **Admin** |
| `POST` | `/servers/health-check/all` | 전체 서버 헬스체크 | **Admin** |
| `GET` | `/servers/:id/models` | 서버 모델 목록 (ComfyUI: 체크포인트, OpenAI: `/v1/models`) | Yes |
| `GET` | `/servers/:id/loras` | 서버 LoRA 목록 | Yes |
| `POST` | `/servers/:id/loras/sync` | LoRA 동기화 시작 | **Admin** |
| `GET` | `/servers/:id/loras/status` | LoRA 동기화 상태 | Yes |

## 작업판 (Workboards)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/workboards` | 활성 작업판 목록 (페이징·검색) | Yes |
| `GET` | `/workboards/:id` | 작업판 상세 | Yes |
| `GET` | `/workboards/admin/:id` | 작업판 상세 (workflowData 포함) | **Admin** |
| `POST` | `/workboards` | 작업판 생성 (`serverId`, `outputFormat`) | **Admin** |
| `PUT` | `/workboards/:id` | 작업판 수정 | **Admin** |
| `PATCH` | `/workboards/:id/activate` | 작업판 활성화 | **Admin** |
| `PATCH` | `/workboards/:id/deactivate` | 작업판 비활성화 (소프트 삭제) | **Admin** |
| `DELETE` | `/workboards/:id` | 작업판 삭제 | **Admin** |
| `POST` | `/workboards/:id/duplicate` | 작업판 복제 | **Admin** |
| `GET` | `/workboards/:id/export` | 작업판 내보내기 (JSON) | **Admin** |
| `POST` | `/workboards/import` | 작업판 가져오기 | **Admin** |
| `GET` | `/workboards/:id/stats` | 작업판 사용 통계 | **Admin** |
| `GET` | `/workboards/:id/lora-models` | 작업판 LoRA 모델 | Yes |
| `POST` | `/workboards/:id/lora-models/refresh` | LoRA 캐시 갱신 | Yes |

## 작업 (Jobs)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `POST` | `/jobs/generate` | 이미지/비디오 생성 요청 | Yes |
| `POST` | `/jobs/generate-prompt` | AI 프롬프트 생성 (텍스트 출력) | Yes |
| `GET` | `/jobs/my` | 내 작업 목록 | Yes |
| `GET` | `/jobs/:id` | 작업 상세 | Yes |
| `DELETE` | `/jobs/:id` | 작업 삭제 | Yes |
| `POST` | `/jobs/:id/retry` | 실패 작업 재시도 | Yes |
| `POST` | `/jobs/:id/cancel` | 진행 중 작업 취소 | Yes |
| `GET` | `/jobs/queue/stats` | 큐 상태 조회 | Yes |

### `POST /jobs/generate` 요청 예시

```json
{
  "workboardId": "...",
  "prompt": "a beautiful landscape",
  "aiModel": { "key": "model_name", "value": "model_path.safetensors" },
  "imageSize": { "key": "1024x1024", "value": "1024x1024" },
  "seed": 12345,
  "additionalParams": {
    "steps": 30,
    "cfg": 7,
    "referenceImage": "<imageId>"
  }
}
```

`workboardId` 의 `serverId.serverType` 와 `outputFormat` 으로 백엔드의 `SERVICE_MAP` 이 dispatch 한다 (v1.8.0).

## 이미지 (Images)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `POST` | `/images/upload` | 레퍼런스 이미지 업로드 (multipart) | Yes |
| `GET` | `/images/uploaded` | 업로드 이미지 목록 | Yes |
| `GET` | `/images/uploaded/:id` | 업로드 이미지 상세 | Yes |
| `PUT` | `/images/uploaded/:id` | 업로드 이미지 수정 (태그 등) | Yes |
| `DELETE` | `/images/uploaded/:id` | 업로드 이미지 삭제 | Yes |
| `GET` | `/images/generated` | 생성 이미지 목록 | Yes |
| `GET` | `/images/generated/:id` | 생성 이미지 상세 | Yes |
| `PUT` | `/images/generated/:id` | 생성 이미지 수정 | Yes |
| `DELETE` | `/images/generated/:id` | 생성 이미지 삭제 | Yes |
| `POST` | `/images/generated/:id/download` | 생성 이미지 다운로드 | Yes |
| `POST` | `/images/bulk-delete` | 다중 삭제 (id 목록) | Yes |
| `POST` | `/images/bulk-delete-by-filter` | 검색 결과 일괄 삭제 | Yes |
| `GET` | `/images/stats` | 이미지 통계 | Yes |

## 비디오 (Videos)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/images/videos` | 생성 비디오 목록 | Yes |
| `GET` | `/images/videos/:id` | 비디오 상세 | Yes |
| `PUT` | `/images/videos/:id` | 비디오 수정 (태그 등) | Yes |
| `DELETE` | `/images/videos/:id` | 비디오 삭제 | Yes |
| `POST` | `/images/videos/:id/download` | 비디오 다운로드 | Yes |

## 미디어 파일 (Files, Signed URL)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/files/*` | Signed URL 검증 후 미디어 서빙 (`/uploads/*` 직접 접근 차단) | 서명 |

## 프로젝트 (Projects, v1.3.0+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/projects` | 프로젝트 목록 | Yes |
| `GET` | `/projects/favorites` | 즐겨찾기 프로젝트 | Yes |
| `GET` | `/projects/by-tag/:tagId` | 태그별 프로젝트 | Yes |
| `GET` | `/projects/:id` | 프로젝트 상세 | Yes |
| `POST` | `/projects` | 프로젝트 생성 | Yes |
| `PUT` | `/projects/:id` | 프로젝트 수정 (커버 이미지 포함) | Yes |
| `DELETE` | `/projects/:id` | 프로젝트 삭제 | Yes |
| `POST` | `/projects/:id/favorite` | 즐겨찾기 토글 | Yes |
| `GET` | `/projects/:id/images` | 프로젝트 이미지 | Yes |
| `GET` | `/projects/:id/jobs` | 프로젝트 작업 | Yes |
| `GET` | `/projects/:id/prompt-data` | 프로젝트 프롬프트 데이터 | Yes |

## 프롬프트 데이터 (PromptData, v1.2.4+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/prompt-data` | 프롬프트 데이터 목록 | Yes |
| `GET` | `/prompt-data/:id` | 상세 | Yes |
| `POST` | `/prompt-data` | 생성 | Yes |
| `PUT` | `/prompt-data/:id` | 수정 | Yes |
| `DELETE` | `/prompt-data/:id` | 삭제 | Yes |
| `POST` | `/prompt-data/:id/use` | 사용 횟수 증가 | Yes |

## 태그 (Tags, v1.2.4+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/tags` | 태그 목록 | Yes |
| `GET` | `/tags/my` | 내 태그 | Yes |
| `GET` | `/tags/search` | 태그 검색 | Yes |
| `POST` | `/tags` | 태그 생성 | Yes |
| `PUT` | `/tags/:id` | 태그 수정 | Yes |
| `DELETE` | `/tags/:id` | 태그 삭제 | Yes |

## 백업 / 복원 (Backup, v1.2.4+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/admin/backup/lock-status` | 백업 진행 잠금 상태 | **Admin** |
| `POST` | `/admin/backup` | 백업 시작 | **Admin** |
| `GET` | `/admin/backup/list` | 백업 목록 | **Admin** |
| `GET` | `/admin/backup/status/:id` | 백업 잡 상태 | **Admin** |
| `GET` | `/admin/backup/download/:id` | 백업 파일 다운로드 | **Admin** |
| `DELETE` | `/admin/backup/:id` | 백업 삭제 | **Admin** |
| `POST` | `/admin/backup/restore/validate` | 복원 파일 검증 (multipart) | **Admin** |
| `POST` | `/admin/backup/restore` | 복원 실행 | **Admin** |
| `GET` | `/admin/backup/restore/list` | 복원 히스토리 | **Admin** |
| `GET` | `/admin/backup/restore/status/:id` | 복원 잡 상태 | **Admin** |

## 업데이트 로그 (UpdateLog, v1.2.5+)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/updatelog/:majorVersion` | `docs/updatelogs/v{major}.md` 마크다운 반환 (대시보드 뷰어용) | Yes |

## 관리자 (Admin)

| Method | Endpoint | Description | Auth |
|:---:|---|---|:---:|
| `GET` | `/admin/users` | 전체 사용자 목록 | **Admin** |
| `POST` | `/admin/users/:id/approve` | 사용자 승인 | **Admin** |
| `POST` | `/admin/users/:id/reject` | 사용자 승인 거절 | **Admin** |
| `DELETE` | `/admin/users/:id` | 사용자 강제 탈퇴 | **Admin** |
| `GET` | `/admin/stats` | 시스템 통합 통계 | **Admin** |
| `GET` | `/admin/jobs` | 전체 작업 목록 | **Admin** |
| `GET` | `/admin/settings/lora` | LoRA 전역 설정 | **Admin** |
| `PUT` | `/admin/settings/lora` | LoRA 전역 설정 수정 (Civitai API 키 / NSFW 정책 등) | **Admin** |
