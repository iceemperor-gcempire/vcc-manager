# MCP Server 도구 호출 명세

VCC Manager MCP 서버가 제공하는 도구(Tool) 목록과 파라미터 명세입니다.

---

## Workboards (작업판)

### `list_workboards`

사용 가능한 작업판 목록 조회. 가장 먼저 호출하여 어떤 생성기가 있는지 확인.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `search` | string | - | 이름/설명 검색 |
| `apiFormat` | `"ComfyUI"` \| `"OpenAI Compatible"` | - | API 포맷 필터 |
| `outputFormat` | `"image"` \| `"video"` \| `"text"` | - | 출력 포맷 필터 |
| `page` | number | - | 페이지 번호 (기본 1) |
| `limit` | number (max 50) | - | 페이지당 항목 수 (기본 10) |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `workboards[].id` | 작업판 ID |
| `workboards[].name` | 작업판 이름 |
| `workboards[].description` | 설명 |
| `workboards[].apiFormat` | API 포맷 (ComfyUI / OpenAI Compatible) |
| `workboards[].outputFormat` | 출력 포맷 (image / video / text) |
| `workboards[].server` | 연결된 서버 이름 |
| `workboards[].models` | 사용 가능한 모델 목록 |
| `workboards[].sizes` | 사용 가능한 크기 목록 |
| `workboards[].usageCount` | 사용 횟수 |
| `pagination` | 페이지네이션 정보 |

---

### `get_workboard`

작업판 상세 정보 조회. `generate` 전에 호출하여 필수 파라미터 확인.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `workboardId` | string | **필수** | 작업판 ID |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `id` | 작업판 ID |
| `name` | 작업판 이름 |
| `description` | 설명 |
| `apiFormat` | API 포맷 |
| `outputFormat` | 출력 포맷 |
| `server` | 연결된 서버 이름 |
| `aiModel` | AI 모델 옵션 (`required: true`, `options: string[]` — 표시 이름 배열) |
| `imageSizes` | 이미지 크기 옵션 (`options: string[]`) |
| `stylePresets` | 스타일 프리셋 옵션 (`options: string[]`) |
| `upscaleMethods` | 업스케일 방식 옵션 (`options: string[]`) |
| `additionalFields[]` | 추가 입력 필드 (`name`, `label`, `type`, `required`, `defaultValue` 등, select 타입은 `options: string[]`) |
| `promptRequired` | 프롬프트 필수 여부 (true) |
| `negativePromptSupported` | 네거티브 프롬프트 지원 여부 (true) |
| `seedSupported` | 시드 지원 여부 (true) |

---

## Jobs (작업)

### `generate`

이미지/비디오 생성. 사전에 `get_workboard`로 옵션 확인 필요. Select 필드(aiModel, imageSize 등)는 옵션 배열의 문자열을 그대로 전달하면 key-value 매핑은 자동 처리.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `workboardId` | string | **필수** | 작업판 ID (`list_workboards`에서 확인) |
| `prompt` | string | **필수** | 생성 프롬프트 |
| `aiModel` | string | **필수** | AI 모델 이름 (`get_workboard` aiModel options 배열에서 확인) |
| `negativePrompt` | string | - | 네거티브 프롬프트 |
| `imageSize` | string | - | 이미지 크기 값 (`get_workboard` imageSizes options에서 확인) |
| `stylePreset` | string | - | 스타일 프리셋 값 |
| `upscaleMethod` | string | - | 업스케일 방식 값 |
| `seed` | number | - | 특정 시드 번호 |
| `randomSeed` | boolean | - | 랜덤 시드 사용 (기본 true) |
| `additionalParams` | Record<string, string\|number\|boolean> | - | 추가 파라미터 (필드명 → 값). 이미지 타입 필드는 `upload_image`로 획득한 imageId 문자열을 전달하면 자동으로 `{ imageId }` 형식으로 변환됨 |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `jobId` | 생성된 작업 ID |
| `status` | 작업 상태 |
| `message` | 결과 메시지 |

---

### `continue_job`

완료/실패 작업을 동일 또는 다른 작업판에서 이어가기. 스마트 필드 매칭으로 원본 작업의 파라미터를 대상 작업판에 자동 매핑. 지정한 파라미터만 오버라이드되고 나머지는 원본에서 매칭.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `jobId` | string | **필수** | 원본 작업 ID |
| `targetWorkboardId` | string | - | 대상 작업판 ID (생략 시 원본과 동일) |
| `prompt` | string | - | 프롬프트 오버라이드 (생략 시 원본 사용) |
| `negativePrompt` | string | - | 네거티브 프롬프트 오버라이드 |
| `aiModel` | string | - | AI 모델 오버라이드 |
| `imageSize` | string | - | 이미지 크기 오버라이드 |
| `seed` | number | - | 시드 오버라이드 |
| `randomSeed` | boolean | - | 랜덤 시드 (기본 true) |
| `additionalParams` | Record<string, string\|number\|boolean> | - | 추가 파라미터 오버라이드 (지정한 키만 오버라이드). 이미지 타입 필드는 imageId 문자열 전달 |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `jobId` | 생성된 작업 ID |
| `status` | 작업 상태 |
| `message` | 결과 메시지 |
| `matching.sourceJob` | 원본 작업 ID |
| `matching.sourceWorkboard` | 원본 작업판 이름 |
| `matching.targetWorkboard` | 대상 작업판 이름 |
| `matching.crossWorkboard` | 크로스 작업판 여부 |
| `matching.matchedFields` | 매칭된 필드 목록 |

---

### `get_job_status`

작업 상태 확인. `generate` 후 폴링하여 완료 대기.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `jobId` | string | **필수** | 작업 ID (`generate` 결과에서 확인) |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `id` | 작업 ID |
| `status` | 작업 상태 (`pending` / `processing` / `completed` / `failed` / `cancelled`) |
| `progress` | 진행률 |
| `prompt` | 프롬프트 |
| `workboard` | 작업판 이름 |
| `createdAt` | 생성 시간 |
| `completedAt` | 완료 시간 |
| `resultImages[]` | 완료 시 생성된 이미지 목록 (`id`, `filename`, `size`) |
| `resultVideos[]` | 완료 시 생성된 비디오 목록 (`id`, `filename`, `size`) |
| `error` | 실패 시 에러 메시지 |

---

### `list_jobs`

내 작업 목록 조회.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `status` | `"pending"` \| `"processing"` \| `"completed"` \| `"failed"` \| `"cancelled"` | - | 상태 필터 |
| `search` | string | - | 프롬프트 검색 |
| `page` | number | - | 페이지 번호 (기본 1) |
| `limit` | number (max 50) | - | 페이지당 항목 수 (기본 10) |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `jobs[].id` | 작업 ID |
| `jobs[].status` | 작업 상태 |
| `jobs[].prompt` | 프롬프트 (최대 100자) |
| `jobs[].workboard` | 작업판 이름 |
| `jobs[].resultImages` | 생성된 이미지 수 |
| `jobs[].resultVideos` | 생성된 비디오 수 |
| `jobs[].createdAt` | 생성 시간 |
| `pagination` | 페이지네이션 정보 |

---

## Media (미디어)

### `download_result`

생성된 이미지/비디오 다운로드. 모든 응답에 `responseType` 필드가 포함되어 클라이언트가 응답 형식을 판별할 수 있습니다.

- **stdio 모드**: 로컬 디스크에 파일 저장 (`responseType: "file"`)
- **HTTP 모드 (`VCC_BASE_URL_FOR_MCP` 설정 시)**: signed URL 반환 (`responseType: "signedUrl"`)
- **HTTP 모드 (`VCC_BASE_URL_FOR_MCP` 미설정 시)**: 이미지는 base64 인라인 (`responseType: "base64"`), 비디오는 메타데이터만 반환 (`responseType: "metadata"`)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `mediaId` | string | **필수** | 미디어 ID (`get_job_status` 결과의 resultImages/resultVideos에서 확인) |
| `mediaType` | `"image"` \| `"video"` | **필수** | 미디어 유형 |
| `downloadDir` | string | - | 다운로드 디렉토리 (stdio 모드 전용, 기본: `~/Downloads/vcc` 또는 `VCC_DOWNLOAD_DIR`) |

**`responseType` 값:**

| 값 | 조건 | 설명 |
|---|------|------|
| `signedUrl` | HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 설정 | 이미지/비디오 모두 signed URL 반환 |
| `base64` | HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 미설정 + 이미지 | base64 인라인 이미지 |
| `metadata` | HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 미설정 + 비디오 | 메타데이터만 반환 (바이너리 없음) |
| `file` | stdio 모드 | 로컬 디스크에 파일 저장 |

**응답 (stdio 모드 — `responseType: "file"`):**

| 필드 | 설명 |
|------|------|
| `responseType` | `"file"` |
| `saved` | 저장된 파일 경로 |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `mediaType` | 미디어 유형 |

**응답 (HTTP 모드 — `responseType: "signedUrl"`):**

`VCC_BASE_URL_FOR_MCP` 설정 시 이미지/비디오 모두 동일한 형식으로 signed URL을 반환합니다.

| 필드 | 설명 |
|------|------|
| `responseType` | `"signedUrl"` |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `mediaType` | 미디어 유형 |
| `signedUrl` | 직접 접근 가능한 Signed URL |

**응답 (HTTP 모드 — `responseType: "base64"`):**

`VCC_BASE_URL_FOR_MCP` 미설정 시 이미지에 대해 MCP `image` 콘텐츠 (base64 인라인) + 메타데이터를 반환합니다.

| 필드 | 설명 |
|------|------|
| `responseType` | `"base64"` |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `mediaType` | 미디어 유형 |

**응답 (HTTP 모드 — `responseType: "metadata"`):**

`VCC_BASE_URL_FOR_MCP` 미설정 시 비디오에 대해 메타데이터만 반환합니다.

| 필드 | 설명 |
|------|------|
| `responseType` | `"metadata"` |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `mediaType` | `"video"` |
| `note` | `VCC_BASE_URL_FOR_MCP` 설정 안내 메시지 |

---

### `upload_image`

base64 인코딩된 이미지를 VCC 서버에 업로드. 반환된 `imageId`를 `generate`/`continue_job`의 `additionalParams`에서 이미지 타입 필드 값으로 사용.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `data` | string | **필수** | base64 인코딩된 이미지 데이터 (data URI prefix 제외) |
| `filename` | string | - | 파일명 (기본: upload.png) |
| `mimeType` | `"image/png"` \| `"image/jpeg"` \| `"image/webp"` | - | MIME 타입 (기본: image/png) |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `imageId` | 업로드된 이미지 ID |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `width` | 이미지 너비 (px) |
| `height` | 이미지 높이 (px) |

**사용 예시:**

```
1. upload_image(data: "iVBOR...") → imageId: "abc123"
2. generate(workboardId, prompt, aiModel, additionalParams: { "referenceImage": "abc123" })
   → 이미지 타입 필드가 자동으로 { imageId: "abc123" } 형식으로 변환됨
```
