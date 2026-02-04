# LoRA 메타데이터 조회 기능 가이드

## 개요

VCC Manager는 ComfyUI 서버의 LoRA 모델 목록을 조회하고, Civitai API를 통해 메타데이터(이름, 설명, 미리보기 이미지, 트리거 워드)를 가져와 표시하는 기능을 제공합니다.

## 아키텍처

```
┌─────────────────┐      ┌──────────────────────────┐      ┌─────────────┐
│  VCC Manager    │ ──── │  ComfyUI Server          │      │  Civitai    │
│  (백엔드)       │      │  + VCC LoRA Hash 노드    │      │  API        │
└────────┬────────┘      └──────────────────────────┘      └──────┬──────┘
         │                         │                              │
         │  1. /api/vcc/lora-hashes│                              │
         │ ────────────────────────>                              │
         │     (파일명 + SHA256)   │                              │
         │ <────────────────────────                              │
         │                                                        │
         │  2. /api/v1/model-versions/by-hash/{hash}              │
         │ ───────────────────────────────────────────────────────>
         │     (메타데이터: 이름, 설명, 트리거워드, 이미지)       │
         │ <───────────────────────────────────────────────────────
         │                                                        │
         │  3. 캐시 저장 (MongoDB)                                │
         └────────────────────────────────────────────────────────┘
```

**핵심 특징:**
- **VCC LoRA Hash 노드**: SHA256 해시 계산만 담당 (간결한 구현)
- **VCC Manager**: Civitai API 호출 및 메타데이터 캐시 관리
- **외부 의존성 최소화**: 자체 커스텀 노드 사용

---

## ComfyUI 커스텀 노드 설치

### VCC LoRA Hash 노드 설치

이 프로젝트에 포함된 커스텀 노드를 ComfyUI에 설치합니다.

```bash
# 방법 1: 복사
cp -r /path/to/vcc-manager/tools/comfyui-vcc-lora-hash ComfyUI/custom_nodes/

# 방법 2: 심볼릭 링크 (개발 시 권장)
ln -s /path/to/vcc-manager/tools/comfyui-vcc-lora-hash ComfyUI/custom_nodes/comfyui-vcc-lora-hash
```

ComfyUI를 재시작하면 다음 메시지가 표시됩니다:
```
[VCC LoRA Hash] Loaded - API endpoint: /api/vcc/lora-hashes
```

### 설치 확인

브라우저에서 확인:
```
http://localhost:8188/api/vcc/lora-hashes
```

또는 curl:
```bash
curl http://localhost:8188/api/vcc/lora-hashes
```

응답 예시:
```json
{
  "success": true,
  "loras": [
    {
      "filename": "add_detail.safetensors",
      "relative_path": "add_detail.safetensors",
      "sha256": "7c6bad76eb54..."
    }
  ],
  "total": 5
}
```

### 노드 미설치 시

VCC LoRA Hash 노드가 설치되지 않은 경우에도 LoRA 목록은 조회할 수 있지만:
- SHA256 해시를 계산할 수 없음
- Civitai 메타데이터 조회 불가
- 파일명만 표시됨

---

## Civitai API 키 설정 (선택사항)

API 키를 설정하면 더 높은 rate limit을 적용받아 많은 LoRA 파일을 빠르게 동기화할 수 있습니다.

### API 키 발급

1. [Civitai](https://civitai.com) 로그인
2. 프로필 → [Account Settings](https://civitai.com/user/account) 이동
3. **API Keys** 섹션에서 **Add API Key** 클릭
4. 키 이름 입력 후 생성
5. 생성된 키 복사 (한 번만 표시됨)

### 환경변수 설정

`.env` 파일에 추가:
```env
# Civitai API Configuration (Optional)
CIVITAI_API_KEY=your_api_key_here
```

> **참고**: Civitai API 키는 VCC Manager에서 관리됩니다. ComfyUI 커스텀 노드에는 별도 설정이 필요 없습니다.

### Rate Limit

| 구분 | 요청 간격 |
|------|----------|
| API 키 없음 | 1초 (초당 1회) |
| API 키 있음 | 더 높은 limit 적용 |

Rate limit 초과 시 자동으로 5초 대기 후 최대 2회 재시도합니다.

---

## 사용 방법

### 1. LoRA 목록 동기화 (관리자)

1. 관리자 페이지 → **서버 관리** 이동
2. ComfyUI 서버 선택
3. **LoRA 동기화** 버튼 클릭
4. 동기화 진행 상황 확인

동기화 과정:
```
1. VCC LoRA Hash 노드 확인
2. LoRA 파일명 + SHA256 해시 조회
3. Civitai API로 각 LoRA의 메타데이터 조회
4. 결과를 서버 단위 캐시에 저장
```

### 2. LoRA 목록 조회 (사용자)

1. 이미지 생성 페이지에서 **LoRA** 버튼 클릭
2. LoRA 목록 모달에서:
   - **검색**: 이름, 설명, 트리거 워드로 검색
   - **필터**: 기본 모델별 필터링 (SDXL, SD 1.5 등)
   - **추가**: 버튼으로 프롬프트에 LoRA 태그 삽입
   - **트리거 워드**: 클릭하여 클립보드에 복사

### 3. 동기화 상태 확인

동기화 진행 중에는 프로그레스 바가 표시됩니다:
- **checking_node**: VCC 노드 확인 중
- **fetching_hashes**: 해시 조회 중
- **fetching_civitai**: Civitai 메타데이터 조회 중
- **completed**: 완료
- **failed**: 실패 (에러 메시지 확인)

---

## API 엔드포인트

### VCC Manager API

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/servers/:id/loras` | LoRA 목록 조회 | 인증 |
| POST | `/api/servers/:id/loras/sync` | LoRA 동기화 시작 | 관리자 |
| GET | `/api/servers/:id/loras/status` | 동기화 상태 조회 | 인증 |

### ComfyUI 커스텀 노드 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/vcc/lora-hashes` | 모든 LoRA 해시 조회 |
| GET | `/api/vcc/lora-hash/{filename}` | 단일 LoRA 해시 조회 |

---

## 트러블슈팅

### "VCC LoRA Hash node not installed" 경고

**원인**: ComfyUI에 VCC LoRA Hash 커스텀 노드가 설치되지 않음

**해결**:
1. `comfyui-vcc-lora-hash` 폴더를 `ComfyUI/custom_nodes/`에 복사
2. ComfyUI 재시작
3. `http://localhost:8188/api/vcc/lora-hashes` 접속하여 확인

### 동기화가 오래 걸림

**원인**: LoRA 파일이 많거나 Civitai API rate limit

**해결**:
1. Civitai API 키 설정 (rate limit 완화)
2. 해시 계산은 파일 크기에 비례하여 시간 소요
3. 이미 동기화된 LoRA는 캐시되어 재동기화 시 빠름

### 일부 LoRA가 "미등록"으로 표시됨

**원인**: 해당 LoRA가 Civitai에 등록되지 않았거나, 파일이 수정됨

**설명**: SHA256 해시로 Civitai에서 검색하므로, 공식 배포본이 아닌 수정된 파일은 찾을 수 없습니다.

### 해시 계산 실패

**원인**: 파일 접근 권한 문제 또는 손상된 파일

**해결**:
1. ComfyUI 로그에서 에러 메시지 확인
2. LoRA 파일 권한 확인
3. 파일이 손상되지 않았는지 확인

---

## 커스텀 노드 구조

```
comfyui-vcc-lora-hash/
├── __init__.py     # API 엔드포인트 및 해시 계산 로직
└── README.md       # 설치 가이드
```

### 지원 파일 형식

- `.safetensors`
- `.ckpt`
- `.pt`

### API 응답 형식

```json
{
  "success": true,
  "loras": [
    {
      "filename": "example.safetensors",
      "relative_path": "subfolder/example.safetensors",
      "sha256": "7c6bad76eb54a8bb5f2e3456789abcdef..."
    }
  ],
  "total": 10
}
```

---

## 데이터 흐름

```
1. 사용자가 "LoRA 동기화" 클릭
   ↓
2. VCC Manager → ComfyUI: GET /api/vcc/lora-hashes
   ↓
3. ComfyUI: 각 LoRA 파일의 SHA256 해시 계산
   ↓
4. ComfyUI → VCC Manager: 파일명 + 해시 목록 반환
   ↓
5. VCC Manager → Civitai: GET /api/v1/model-versions/by-hash/{hash}
   (각 해시에 대해 순차적으로, 1초 간격)
   ↓
6. Civitai → VCC Manager: 메타데이터 반환
   ↓
7. VCC Manager: MongoDB에 캐시 저장
   ↓
8. 사용자에게 결과 표시
```

---

## 참고 링크

- [Civitai API Documentation](https://developer.civitai.com/docs/api/public-rest)
- [ComfyUI Custom Nodes Guide](https://docs.comfy.org/development/custom-nodes/overview)

---

**작성일**: 2026년 2월 4일
**버전**: 2.0 (VCC LoRA Hash 노드 기반)
