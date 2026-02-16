---
name: vcc-generate
description: VCC Manager MCP 도구를 사용하여 이미지/비디오를 생성하고 결과를 확인합니다. 사용자가 이미지 생성, 비디오 생성, 작업판 조회 등을 요청할 때 사용합니다.
argument-hint: [프롬프트 또는 명령]
---

# VCC Manager 이미지/비디오 생성

VCC Manager MCP 서버의 도구를 사용하여 이미지/비디오 생성 작업을 수행합니다.

## 도구 호출 명세

전체 API 명세는 [docs/MCP_SERVER_API.md](../../../docs/MCP_SERVER_API.md)를 참조하세요.

## 작업 흐름

### 1단계: 작업판 확인
사용자가 특정 작업판을 지정하지 않은 경우, 먼저 사용 가능한 작업판을 조회합니다.

```
list_workboards → 작업판 목록 확인
get_workboard(workboardId) → 선택한 작업판의 모델, 크기, 파라미터 확인
```

### 2단계: 생성 요청
작업판 정보를 기반으로 생성 요청을 보냅니다.

```
generate(workboardId, prompt, aiModel, ...) → jobId 획득
```

**필수 파라미터**: `workboardId`, `prompt`, `aiModel`
**선택 파라미터**: `negativePrompt`, `imageSize`, `stylePreset`, `seed`, `additionalParams` 등

### 3단계: 완료 대기
작업 상태를 폴링하여 완료를 확인합니다.

```
get_job_status(jobId) → status 확인
- pending/processing: 5초 후 재확인
- completed: 결과 확인 → 4단계로
- failed: 에러 메시지 전달
```

### 4단계: 결과 확인
완료된 작업의 결과물을 다운로드합니다.

```
download_result(mediaId, mediaType) → 이미지/비디오 획득
```

## 이어가기 (continue_job)

기존 작업을 기반으로 파라미터를 변경하여 재생성할 때 사용합니다.

```
continue_job(jobId, prompt?, aiModel?, ...) → 새 작업 생성
```

- `targetWorkboardId` 지정 시 다른 작업판으로 이어가기 가능
- 지정하지 않은 파라미터는 원본에서 자동 매칭

## 사용자 요청 처리 규칙

1. **프롬프트만 제공된 경우**: 작업판 목록을 조회하여 적합한 작업판을 선택하고 사용자에게 확인
2. **작업판 + 프롬프트가 모두 제공된 경우**: get_workboard로 파라미터 확인 후 바로 생성
3. **생성 완료 후**: 결과 이미지/비디오를 download_result로 가져와서 보여주기
4. **실패 시**: 에러 원인을 분석하고 해결 방안 제시
5. **이어가기 요청 시**: continue_job으로 원본 파라미터를 자동 매칭하여 재생성

## 사용자 요청

$ARGUMENTS
