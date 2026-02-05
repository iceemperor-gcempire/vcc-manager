/**
 * LoRA 프롬프트 조작 유틸리티 함수
 */

/**
 * 파일명에서 LoRA 태그 생성
 * @param {string} filename - LoRA 파일명 (경로 포함 가능)
 * @returns {string} LoRA 태그 (예: <lora:modelName:1>)
 */
export function generateLoraTag(filename) {
  // 경로에서 파일명만 추출 후 확장자 제거
  const basename = filename.split(/[/\\]/).pop();
  const nameWithoutExt = basename.replace(/\.[^/.]+$/, '');
  return `<lora:${nameWithoutExt}:1>`;
}

/**
 * 파일명에서 LoRA 이름 추출 (확장자 제거)
 * @param {string} filename - LoRA 파일명 (경로 포함 가능)
 * @returns {string} LoRA 이름
 */
export function extractLoraName(filename) {
  const basename = filename.split(/[/\\]/).pop();
  return basename.replace(/\.[^/.]+$/, '');
}

/**
 * 프롬프트에 특정 LoRA 태그가 존재하는지 확인
 * @param {string} prompt - 프롬프트 문자열
 * @param {string} loraName - LoRA 이름 (확장자 없음)
 * @returns {boolean} 존재 여부
 */
export function loraTagExists(prompt, loraName) {
  if (!prompt || !loraName) return false;
  // <lora:이름:숫자> 패턴으로 검색 (대소문자 무시)
  const escapedName = loraName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<lora:${escapedName}:\\d+(?:\\.\\d+)?>`, 'i');
  return regex.test(prompt);
}

/**
 * 프롬프트에 특정 텍스트가 존재하는지 확인
 * @param {string} prompt - 프롬프트 문자열
 * @param {string} text - 검색할 텍스트
 * @returns {boolean} 존재 여부
 */
export function textExists(prompt, text) {
  if (!prompt || !text) return false;
  return prompt.toLowerCase().includes(text.toLowerCase());
}

/**
 * 커서 위치에 텍스트 삽입
 * @param {string} prompt - 현재 프롬프트
 * @param {string} text - 삽입할 텍스트
 * @param {number} cursorPosition - 커서 위치
 * @returns {{ newPrompt: string, newCursorPosition: number }} 새 프롬프트와 커서 위치
 */
export function insertAtCursor(prompt, text, cursorPosition) {
  const before = prompt.slice(0, cursorPosition);
  const after = prompt.slice(cursorPosition);

  // 앞뒤로 적절한 구분자 추가
  let separator = '';
  if (before.length > 0 && !before.endsWith(' ') && !before.endsWith(',') && !before.endsWith('\n')) {
    separator = ', ';
  } else if (before.endsWith(',')) {
    separator = ' ';
  }

  const newPrompt = before + separator + text + after;
  const newCursorPosition = before.length + separator.length + text.length;

  return { newPrompt, newCursorPosition };
}

/**
 * 프롬프트 끝에 텍스트 추가
 * @param {string} prompt - 현재 프롬프트
 * @param {string} text - 추가할 텍스트
 * @returns {string} 새 프롬프트
 */
export function appendToPrompt(prompt, text) {
  if (!prompt || prompt.trim().length === 0) {
    return text;
  }
  const trimmed = prompt.trim();
  if (trimmed.endsWith(',')) {
    return trimmed + ' ' + text;
  }
  return trimmed + ', ' + text;
}

/**
 * 트리거 워드와 LoRA 태그를 함께 삽입
 * @param {string} prompt - 현재 프롬프트
 * @param {string} triggerWord - 트리거 워드
 * @param {string} loraFilename - LoRA 파일명
 * @param {number} cursorPosition - 커서 위치 (선택적, 없으면 끝에 추가)
 * @returns {{ newPrompt: string, addedLora: boolean, addedTrigger: boolean }} 결과
 */
export function insertTriggerWordWithLora(prompt, triggerWord, loraFilename, cursorPosition = null) {
  const loraName = extractLoraName(loraFilename);
  const loraTag = generateLoraTag(loraFilename);

  let newPrompt = prompt || '';
  let addedLora = false;
  let addedTrigger = false;

  // LoRA 태그 존재 여부 확인 및 추가
  if (!loraTagExists(newPrompt, loraName)) {
    newPrompt = appendToPrompt(newPrompt, loraTag);
    addedLora = true;
  }

  // 트리거 워드 존재 여부 확인 및 추가
  if (!textExists(newPrompt, triggerWord)) {
    if (cursorPosition !== null && cursorPosition <= prompt.length) {
      // 커서 위치에 삽입
      const result = insertAtCursor(newPrompt, triggerWord, cursorPosition);
      newPrompt = result.newPrompt;
    } else {
      // 끝에 추가
      newPrompt = appendToPrompt(newPrompt, triggerWord);
    }
    addedTrigger = true;
  }

  return { newPrompt, addedLora, addedTrigger };
}

/**
 * LoRA 태그만 삽입 (중복 검사 포함)
 * @param {string} prompt - 현재 프롬프트
 * @param {string} loraFilename - LoRA 파일명
 * @param {number} cursorPosition - 커서 위치 (선택적)
 * @returns {{ newPrompt: string, newCursorPosition: number, added: boolean }} 결과
 */
export function insertLoraTag(prompt, loraFilename, cursorPosition = null) {
  const loraName = extractLoraName(loraFilename);
  const loraTag = generateLoraTag(loraFilename);

  // 이미 존재하면 추가하지 않음
  if (loraTagExists(prompt, loraName)) {
    return {
      newPrompt: prompt,
      newCursorPosition: cursorPosition || prompt.length,
      added: false
    };
  }

  if (cursorPosition !== null) {
    const result = insertAtCursor(prompt || '', loraTag, cursorPosition);
    return { ...result, added: true };
  }

  const newPrompt = appendToPrompt(prompt || '', loraTag);
  return {
    newPrompt,
    newCursorPosition: newPrompt.length,
    added: true
  };
}
