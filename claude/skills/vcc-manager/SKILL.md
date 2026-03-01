---
name: vcc-manager
description: VCC Manager MCP 도구를 사용하여 작업판 조회, 이미지/비디오 생성, 작업 관리, 결과 다운로드 등을 수행합니다.
argument-hint: [명령 또는 프롬프트]
---

# VCC Manager MCP 스킬

VCC Manager MCP 서버의 도구를 사용하여 이미지/비디오 생성 작업을 수행합니다.

---

## 도구 목록

| 도구 | 설명 |
|------|------|
| `list_workboards` | 사용 가능한 작업판 목록 조회 |
| `get_workboard` | 작업판 상세 정보 (모델, 크기, 파라미터) 조회 |
| `generate` | 이미지/비디오 생성 요청 |
| `continue_job` | 기존 작업 기반 재생성 (이어가기) |
| `get_job_status` | 작업 상태 및 결과 확인 |
| `list_jobs` | 내 작업 목록 조회 |
| `upload_image` | base64 이미지를 VCC 서버에 업로드하여 이미지 ID 획득 |
| `download_result` | 생성된 이미지/비디오 다운로드 |

---

## 작업 흐름

### 1단계: 작업판 확인

사용자가 특정 작업판을 지정하지 않은 경우, 먼저 사용 가능한 작업판을 조회합니다.

```
list_workboards → 작업판 목록 확인
get_workboard(workboardId) → 선택한 작업판의 모델, 크기, 파라미터 확인
```

**list_workboards 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `search` | string | - | 이름/설명 검색 |
| `apiFormat` | `"ComfyUI"` \| `"OpenAI Compatible"` | - | API 포맷 필터 |
| `outputFormat` | `"image"` \| `"video"` \| `"text"` | - | 출력 포맷 필터 |
| `page` | number | - | 페이지 번호 (기본 1) |
| `limit` | number (max 50) | - | 페이지당 항목 수 (기본 10) |

**get_workboard 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `workboardId` | string | **필수** | 작업판 ID |

**get_workboard 주요 응답 필드:**
- `aiModel` — AI 모델 옵션 (`options: string[]` — 모델 이름 배열)
- `imageSizes` — 이미지 크기 옵션 (`options: string[]`)
- `stylePresets` — 스타일 프리셋 옵션 (`options: string[]`)
- `upscaleMethods` — 업스케일 방식 옵션 (`options: string[]`)
- `additionalFields[]` — 추가 입력 필드 (`name`, `label`, `type`, `required`, `defaultValue`, select 타입은 `options: string[]`)
- `promptRequired` — 프롬프트 필수 여부
- `negativePromptSupported` — 네거티브 프롬프트 지원 여부
- `seedSupported` — 시드 지원 여부

> **중요**: 모든 select 옵션은 문자열 배열입니다. `generate`/`continue_job` 호출 시 배열의 문자열을 그대로 전달하면 됩니다.

### 2단계: 생성 요청

작업판 정보를 기반으로 생성 요청을 보냅니다. Select 필드(`aiModel`, `imageSize` 등)는 `get_workboard`에서 확인한 **옵션 배열의 문자열**을 그대로 전달합니다.

```
generate(workboardId, prompt, aiModel, ...) → jobId 획득
```

**generate 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `workboardId` | string | **필수** | 작업판 ID |
| `prompt` | string | **필수** | 생성 프롬프트 |
| `aiModel` | string | **필수** | AI 모델 이름 (`get_workboard` aiModel options 배열에서 확인) |
| `negativePrompt` | string | - | 네거티브 프롬프트 |
| `imageSize` | string | - | 이미지 크기 이름 |
| `stylePreset` | string | - | 스타일 프리셋 이름 |
| `upscaleMethod` | string | - | 업스케일 방식 이름 |
| `seed` | number | - | 특정 시드 번호 |
| `randomSeed` | boolean | - | 랜덤 시드 사용 (기본 true) |
| `additionalParams` | Record<string, string\|number\|boolean> | - | 추가 파라미터 (필드명 → 값). 이미지 타입 필드는 `upload_image`로 얻은 imageId 문자열을 전달 |

### 3단계: 완료 대기

작업 상태를 폴링하여 완료를 확인합니다.

```
get_job_status(jobId) → status 확인
- pending/processing: 5초 후 재확인
- completed: 결과 확인 → 4단계로
- failed: 에러 메시지 전달
```

**get_job_status 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `jobId` | string | **필수** | 작업 ID |

**주요 응답 필드:**
- `status` — `pending` / `processing` / `completed` / `failed` / `cancelled`
- `progress` — 진행률
- `resultImages[]` — 완료 시 생성된 이미지 목록 (`id`, `filename`, `size`)
- `resultVideos[]` — 완료 시 생성된 비디오 목록 (`id`, `filename`, `size`)
- `error` — 실패 시 에러 메시지

### 4단계: 결과 확인

완료된 작업의 결과물을 다운로드합니다.

```
download_result(mediaId, mediaType) → 이미지/비디오 획득
```

**download_result 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `mediaId` | string | **필수** | 미디어 ID (`get_job_status` 결과의 resultImages/resultVideos에서 확인) |
| `mediaType` | `"image"` \| `"video"` | **필수** | 미디어 유형 |
| `downloadDir` | string | - | 다운로드 디렉토리 (stdio 모드 전용, 기본: `~/Downloads/vcc`) |

**응답 동작 (`responseType` 필드로 구분):**
- **stdio 모드** (`responseType: "file"`): 로컬 디스크에 파일 저장, `saved` 경로 반환
- **HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 설정 시** (`responseType: "signedUrl"`): signed URL 반환 (이미지/비디오 모두)
- **HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 미설정 시, 이미지** (`responseType: "base64"`): base64 인라인 반환
- **HTTP 모드 + `VCC_BASE_URL_FOR_MCP` 미설정 시, 비디오** (`responseType: "metadata"`): 메타데이터만 반환

---

## 이미지 업로드 (upload_image)

작업판의 이미지 타입 커스텀 필드(예: 참조 이미지)에 사용할 이미지를 업로드합니다.

```
upload_image(data, filename?, mimeType?) → imageId 획득
generate(..., additionalParams: { "참조이미지필드명": imageId }) → 생성
```

**upload_image 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `data` | string | **필수** | base64 인코딩된 이미지 데이터 (data URI prefix 제외) |
| `filename` | string | - | 파일명 (기본: upload.png) |
| `mimeType` | `"image/png"` \| `"image/jpeg"` \| `"image/webp"` | - | MIME 타입 (기본: image/png) |

**응답 필드:**

| 필드 | 설명 |
|------|------|
| `imageId` | 업로드된 이미지 ID (`generate`의 `additionalParams`에서 이미지 타입 필드 값으로 사용) |
| `filename` | 파일명 |
| `size` | 파일 크기 (bytes) |
| `width` | 이미지 너비 (px) |
| `height` | 이미지 높이 (px) |

---

## 이어가기 (continue_job)

기존 작업을 기반으로 파라미터를 변경하여 재생성할 때 사용합니다. 스마트 필드 매칭으로 원본 파라미터를 대상 작업판에 자동 매핑합니다.

```
continue_job(jobId, prompt?, aiModel?, ...) → 새 작업 생성
```

**continue_job 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `jobId` | string | **필수** | 원본 작업 ID |
| `targetWorkboardId` | string | - | 대상 작업판 ID (생략 시 원본과 동일) |
| `prompt` | string | - | 프롬프트 오버라이드 |
| `negativePrompt` | string | - | 네거티브 프롬프트 오버라이드 |
| `aiModel` | string | - | AI 모델 이름 오버라이드 |
| `imageSize` | string | - | 이미지 크기 이름 오버라이드 |
| `seed` | number | - | 시드 오버라이드 |
| `randomSeed` | boolean | - | 랜덤 시드 (기본 true) |
| `additionalParams` | Record<string, string\|number\|boolean> | - | 추가 파라미터 오버라이드 (이미지 타입 필드는 imageId 문자열 전달) |

- `targetWorkboardId` 지정 시 다른 작업판으로 이어가기 가능
- 지정하지 않은 파라미터는 원본에서 자동 매칭

---

## 작업 목록 조회 (list_jobs)

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `status` | `"pending"` \| `"processing"` \| `"completed"` \| `"failed"` \| `"cancelled"` | - | 상태 필터 |
| `search` | string | - | 프롬프트 검색 |
| `page` | number | - | 페이지 번호 (기본 1) |
| `limit` | number (max 50) | - | 페이지당 항목 수 (기본 10) |

---

## 사용자 요청 처리 규칙

1. **프롬프트만 제공된 경우**: `list_workboards`로 작업판 목록을 조회하여 적합한 작업판을 선택하고 사용자에게 확인
2. **작업판 + 프롬프트가 모두 제공된 경우**: `get_workboard`로 파라미터 확인 후 바로 생성
3. **생성 완료 후**: `download_result`로 결과 이미지/비디오를 가져와서 보여주기
4. **실패 시**: 에러 원인을 분석하고 해결 방안 제시
5. **이어가기 요청 시**: `continue_job`으로 원본 파라미터를 자동 매칭하여 재생성
6. **작업 확인 요청 시**: `list_jobs`로 작업 목록 조회 또는 `get_job_status`로 특정 작업 상태 확인

---

## 사용자 요청

$ARGUMENTS
