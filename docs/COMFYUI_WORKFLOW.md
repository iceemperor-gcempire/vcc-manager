# ComfyUI Workflow 처리 로직 문서

## 📋 개요

VCC Manager에서 ComfyUI 워크플로우를 처리하는 전체적인 로직과 데이터 흐름을 설명합니다.

## 🔄 전체 워크플로우

```
사용자 입력 → 작업 큐 추가 → Workflow 데이터 주입 → ComfyUI API 호출 → 결과 처리 → 이미지 저장
```

## 📁 주요 파일 구조

```
src/
├── routes/jobs.js              # 이미지 생성 API 엔드포인트
├── services/
│   ├── queueService.js         # 작업 큐 및 워크플로우 처리 핵심 로직
│   └── comfyUIService.js       # ComfyUI API 통신
└── models/
    ├── Workboard.js           # 작업판(워크플로우 템플릿) 모델
    ├── ImageGenerationJob.js  # 이미지 생성 작업 모델
    └── GeneratedImage.js      # 생성된 이미지 모델
```

## 🎯 1. 사용자 요청 처리 (`routes/jobs.js`)

### 요청 데이터 구조
```javascript
{
  workboardId: "작업판 ID",
  prompt: "이미지 생성 프롬프트",
  negativePrompt: "네거티브 프롬프트",
  aiModel: {key: "모델명", value: "모델파일경로"},
  imageSize: {key: "1024x1024", value: "1024x1024"},
  seed: 12345, // 사용자 지정 시드 (옵션)
  randomSeed: false, // 랜덤 시드 사용 여부
  additionalParams: {
    steps: 28,
    cfg: 8,
    sampler: "euler",
    scheduler: "simple"
  },
  referenceImages: [], // 참조 이미지 배열
  // ... 기타 파라미터
}
```

### 처리 과정
1. **입력 검증**: 필수 필드 확인 (`workboardId`, `prompt`, `aiModel`)
2. **참조 이미지 검증**: 업로드된 이미지 권한 확인
3. **작업 데이터 준비**: `inputData` 객체 생성
4. **큐 작업 추가**: `addImageGenerationJob()` 호출

## 🔧 2. 작업 큐 처리 (`queueService.js`)

### 2.1 작업 초기화
```javascript
const addImageGenerationJob = async (userId, workboardId, inputData) => {
  // 1. Workboard 조회 및 검증
  // 2. ImageGenerationJob 생성
  // 3. Bull Queue에 작업 추가
  // 4. 사용량 통계 업데이트
}
```

### 2.2 워크플로우 데이터 주입
```javascript
const injectInputsIntoWorkflow = (workflowTemplate, inputData, workboard) => {
  // 핵심 처리 로직
}
```

#### A. 값 추출 헬퍼 함수
```javascript
const extractValue = (field) => {
  // 키-값 객체 {key: "표시명", value: "실제값"} 처리
  if (typeof field === 'object' && field?.value !== undefined) {
    return field.value;
  }
  return field || '';
};
```

#### B. Seed 값 처리 로직
```javascript
// 사용자 지정 또는 랜덤 생성
let seedValue;
if (inputData.seed !== undefined && inputData.seed !== null && inputData.seed !== '') {
  const extractedSeed = extractValue(inputData.seed);
  const parsedSeed = parseInt(extractedSeed);
  
  if (!isNaN(parsedSeed)) {
    seedValue = parsedSeed;
  } else {
    seedValue = generateRandomSeed(); // 64비트 부호없는 랜덤 정수
  }
} else {
  seedValue = generateRandomSeed();
}
```

#### C. 이미지 크기 처리
```javascript
const extractedImageSize = extractValue(inputData.imageSize) || '512x512';
let width = 512, height = 512;
if (extractedImageSize.includes('x')) {
  [width, height] = extractedImageSize.split('x').map(s => parseInt(s) || 512);
}
```

#### D. 플레이스홀더 매핑 테이블
```javascript
const replacements = {
  '{{##prompt##}}': { value: inputData.prompt || '', type: 'string' },
  '{{##negative_prompt##}}': { value: inputData.negativePrompt || '', type: 'string' },
  '{{##model##}}': { value: extractValue(inputData.aiModel), type: 'string' },
  '{{##width##}}': { value: width, type: 'number' },
  '{{##height##}}': { value: height, type: 'number' },
  '{{##seed##}}': { value: seedValue, type: 'number' },
  '{{##steps##}}': { value: parseInt(inputData.additionalParams?.steps) || 20, type: 'number' },
  '{{##cfg##}}': { value: parseFloat(inputData.additionalParams?.cfg) || 7, type: 'number' },
  '{{##sampler##}}': { value: inputData.additionalParams?.sampler || 'euler', type: 'string' },
  '{{##scheduler##}}': { value: inputData.additionalParams?.scheduler || 'normal', type: 'string' },
  // ... 추가 필드들
};
```

### 2.3 워크플로우 JSON 치환 로직

#### A. 재귀적 객체 순회
```javascript
const replaceInObject = (obj, replacements, seedValue = null) => {
  if (typeof obj === 'string') {
    // 플레이스홀더 문자열 치환
    const replacement = replacements[obj];
    if (replacement) return replacement.value;
    
    // 부분 문자열 치환
    let result = obj;
    Object.keys(replacements).forEach(key => {
      if (result.includes(key)) {
        result = result.replace(new RegExp(key, 'g'), replacements[key].value);
      }
    });
    return result;
  } 
  else if (Array.isArray(obj)) {
    return obj.map(item => replaceInObject(item, replacements, seedValue));
  } 
  else if (obj && typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => {
      // 🎲 핵심: seed 키 자동 치환 로직
      if (key === 'seed' && seedValue !== null && typeof obj[key] === 'number') {
        console.log(`🎲 Auto-replacing hardcoded seed ${obj[key]} with generated seed ${seedValue}`);
        result[key] = seedValue;
      } else {
        result[key] = replaceInObject(obj[key], replacements, seedValue);
      }
    });
    return result;
  }
  return obj;
};
```

#### B. 처리 방식
1. **JSON 파싱 시도**: `JSON.parse(workflowTemplate)`
2. **재귀 치환**: `replaceInObject()` 호출
3. **실패 시 Fallback**: 문자열 치환 방식

## 🌐 3. ComfyUI API 통신 (`comfyUIService.js`)

### 3.1 워크플로우 제출
```javascript
const submitWorkflow = async (serverUrl, workflowJson, progressCallback) => {
  // 1. UUID 클라이언트 ID 생성
  // 2. HTTP POST로 워크플로우 제출
  // 3. WebSocket 연결로 실시간 상태 모니터링
  // 4. 완료 시 이미지 다운로드
}
```

### 3.2 실시간 모니터링
- **WebSocket 연결**: `ws://server:8188/ws?clientId={uuid}`
- **진행률 업데이트**: `progress` 이벤트 처리
- **완료 감지**: `executing` 이벤트에서 `node === null`
- **에러 처리**: `execution_error` 이벤트

### 3.3 결과 이미지 처리
```javascript
// 히스토리 조회
const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`);

// 이미지 다운로드
const imageUrl = `${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=${imageInfo.type}`;
const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
```

## 💾 4. 이미지 저장 및 메타데이터

### 4.1 파일 저장
```javascript
const saveGeneratedImages = async (jobId, comfyImages, inputData) => {
  // 1. 파일명 생성: generated_${timestamp}_${index}.png
  // 2. uploads/generated/ 디렉토리에 저장
  // 3. Sharp로 메타데이터 추출
  // 4. MongoDB에 GeneratedImage 문서 생성
}
```

### 4.2 메타데이터 구조
```javascript
{
  filename: "generated_1234567890_0.png",
  originalName: "generated_1234567890_0.png",
  mimeType: "image/png",
  size: 1234567, // 바이트
  url: "/uploads/generated/generated_1234567890_0.png",
  metadata: {
    width: 1024,
    height: 1024,
    format: "png"
  },
  generationParams: {
    prompt: "사용자 프롬프트",
    negativePrompt: "네거티브 프롬프트",
    model: "모델 정보",
    seed: 1234567890, // 실제 사용된 시드
    imageSize: "1024x1024",
    additionalParams: { steps: 28, cfg: 8, ... }
  }
}
```

## 🔍 5. 주요 처리 케이스

### 5.1 Seed 값 처리 시나리오

#### A. 사용자 지정 시드
```javascript
// 입력: inputData.seed = 12345
// 결과: seedValue = 12345
// 워크플로우: "seed": 12345 (하드코딩된 값도 덮어씀)
```

#### B. 랜덤 시드
```javascript
// 입력: inputData.seed = undefined 또는 randomSeed = true
// 결과: seedValue = generateRandomSeed() // 예: -8234567891234567890
// 워크플로우: "seed": -8234567891234567890
```

#### C. 키-값 객체 시드
```javascript
// 입력: inputData.seed = {key: "고정 시드", value: "99999"}
// 결과: seedValue = 99999
// 워크플로우: "seed": 99999
```

### 5.2 에러 처리

#### A. 잘못된 시드 값
```javascript
// 입력: inputData.seed = "abc123" (숫자 변환 불가)
// 결과: console.warn() + 랜덤 시드 사용
```

#### B. 워크플로우 JSON 파싱 실패
```javascript
// 결과: fallbackStringReplacement() 사용
```

#### C. ComfyUI 서버 연결 실패
```javascript
// 결과: job.status = 'failed', 에러 메시지 저장
```

## 🎛️ 6. 설정 및 환경변수

### 6.1 Queue 설정
```javascript
// Bull Queue 옵션
{
  removeOnComplete: 50,  // 완료된 작업 50개까지 보관
  removeOnFail: 20,      // 실패한 작업 20개까지 보관
  attempts: 3,           // 최대 3회 재시도
  backoff: {
    type: 'exponential',
    delay: 2000
  }
}
```

### 6.2 환경변수
- `REDIS_URL`: Redis 연결 URL
- `COMFY_UI_BASE_URL`: ComfyUI 서버 기본 URL
- `UPLOAD_PATH`: 파일 업로드 경로

## 🔧 7. 확장 가능한 구조

### 7.1 추가 입력 필드 처리
```javascript
// Workboard.additionalInputFields 배열
[
  {
    name: "customParam",
    type: "number", 
    formatString: "{{##customParam##}}",
    defaultValue: 10
  }
]

// 자동으로 replacements 객체에 추가됨
replacements["{{##customParam##}}"] = { value: 10, type: "number" };
```

### 7.2 새로운 플레이스홀더 추가
1. `replacements` 객체에 새 항목 추가
2. `extractValue()` 함수로 값 추출 로직 통일
3. 타입별 변환 로직 구현

## 🚨 8. 주의사항 및 제한사항

### 8.1 Seed 값 범위
- ComfyUI: 64비트 부호없는 정수 (0 ~ 2^64-1, 음수 불가)
- JavaScript: 0 ~ Number.MAX_SAFE_INTEGER 범위에서 생성
- 음수 입력 시: 자동으로 절댓값으로 변환

### 8.2 성능 고려사항
- 큰 워크플로우 JSON 파싱 시 메모리 사용량
- 동시 처리 작업 수 제한 (현재 5개)
- Redis 연결 풀 관리

### 8.3 보안 고려사항
- 워크플로우 템플릿 검증 필요
- 사용자 입력 값 sanitization
- 파일 업로드 크기 및 타입 제한

---

**작성일**: 2026년 1월 24일  
**버전**: 1.0  
**작성자**: Claude Code Assistant