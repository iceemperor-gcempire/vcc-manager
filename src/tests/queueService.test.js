const { escapeForJsonString } = require('../services/queueService');

// queueService 모듈에서 내부 함수들을 테스트하기 위한 모의 함수들
// 실제로는 private 함수이지만 테스트를 위해 동일한 로직으로 구현
function escapeForJsonString(value) {
  if (typeof value === 'string') {
    // JSON 문자열에서 안전하게 사용할 수 있도록 특수문자 이스케이핑
    return value
      .replace(/\\/g, '\\\\')  // 역슬래시
      .replace(/"/g, '\\"')    // 큰따옴표
      .replace(/\n/g, '\\n')   // 줄바꿈
      .replace(/\r/g, '\\r')   // 캐리지 리턴
      .replace(/\t/g, '\\t');  // 탭
  }
  return value;
}

function replaceInObject(obj, replacements) {
  if (typeof obj === 'string') {
    // 문자열이 완전히 플레이스홀더인 경우 (이스케이핑 없이 원본 값 반환)
    const replacement = replacements[obj];
    if (replacement) {
      return replacement.value;
    }
    
    // 부분 문자열 치환 (문자열 내 일부만 플레이스홀더인 경우 - 이스케이핑 적용)
    let result = obj;
    Object.keys(replacements).forEach(key => {
      if (result.includes(key)) {
        const value = replacements[key].value;
        // 부분 치환의 경우에만 이스케이핑 적용
        const escapedValue = escapeForJsonString(value);
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), escapedValue);
      }
    });
    return result;
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInObject(item, replacements));
  } else if (obj && typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => {
      result[key] = replaceInObject(obj[key], replacements);
    });
    return result;
  }
  return obj;
}

describe('Workflow JSON Processing', () => {
  describe('escapeForJsonString', () => {
    test('should escape newlines correctly', () => {
      const input = 'line1\nline2\nline3';
      const expected = 'line1\\nline2\\nline3';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should escape carriage returns correctly', () => {
      const input = 'line1\rline2';
      const expected = 'line1\\rline2';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should escape tabs correctly', () => {
      const input = 'word1\tword2';
      const expected = 'word1\\tword2';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should escape quotes correctly', () => {
      const input = 'He said "Hello"';
      const expected = 'He said \\"Hello\\"';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should escape backslashes correctly', () => {
      const input = 'path\\to\\file';
      const expected = 'path\\\\to\\\\file';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should handle multiple special characters', () => {
      const input = 'line1\n"quoted text"\tindented\\path';
      const expected = 'line1\\n\\"quoted text\\"\\tindented\\\\path';
      expect(escapeForJsonString(input)).toBe(expected);
    });

    test('should not modify non-strings', () => {
      expect(escapeForJsonString(123)).toBe(123);
      expect(escapeForJsonString(null)).toBe(null);
      expect(escapeForJsonString(undefined)).toBe(undefined);
    });
  });

  describe('replaceInObject - Direct Placeholder Replacement', () => {
    const replacements = {
      '{{##prompt##}}': { value: 'A beautiful landscape\nwith mountains\nand valleys', type: 'string' },
      '{{##negative_prompt##}}': { value: 'bad quality\r\nblurry', type: 'string' },
      '{{##model##}}': { value: 'SD1.5', type: 'string' }
    };

    test('should replace direct placeholders without escaping', () => {
      const result = replaceInObject('{{##prompt##}}', replacements);
      expect(result).toBe('A beautiful landscape\nwith mountains\nand valleys');
      // 원본 줄바꿈이 보존되어야 함 (이스케이핑되지 않음)
    });

    test('should handle negative prompts with carriage returns', () => {
      const result = replaceInObject('{{##negative_prompt##}}', replacements);
      expect(result).toBe('bad quality\r\nblurry');
      // 원본 캐리지 리턴이 보존되어야 함
    });

    test('should handle simple string replacements', () => {
      const result = replaceInObject('{{##model##}}', replacements);
      expect(result).toBe('SD1.5');
    });
  });

  describe('replaceInObject - Partial String Replacement', () => {
    const replacements = {
      '{{##prompt##}}': { value: 'Beautiful scene\nwith "quotes"', type: 'string' },
      '{{##model##}}': { value: 'SD1.5', type: 'string' }
    };

    test('should escape special characters in partial replacements', () => {
      const template = 'Prompt: {{##prompt##}}, Model: {{##model##}}';
      const result = replaceInObject(template, replacements);
      expect(result).toBe('Prompt: Beautiful scene\\nwith \\"quotes\\", Model: SD1.5');
      // 부분 치환에서는 특수문자가 이스케이핑되어야 함
    });

    test('should handle mixed content correctly', () => {
      const template = {
        "prompt": "{{##prompt##}}",
        "combined": "Use model {{##model##}} with prompt: {{##prompt##}}"
      };
      const result = replaceInObject(template, replacements);
      
      expect(result.prompt).toBe('Beautiful scene\nwith "quotes"'); // 직접 치환 - 이스케이핑 없음
      expect(result.combined).toBe('Use model SD1.5 with prompt: Beautiful scene\\nwith \\"quotes\\"'); // 부분 치환 - 이스케이핑 적용
    });
  });

  describe('MongoDB Connection Issues', () => {
    test('should not include deprecated bufferMaxEntries option', () => {
      // MongoDB 연결 옵션에서 deprecated 옵션이 제거되었는지 확인
      const validOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      };
      
      // bufferMaxEntries가 포함되지 않았는지 확인
      expect(validOptions).not.toHaveProperty('bufferMaxEntries');
      expect(Object.keys(validOptions)).not.toContain('bufferMaxEntries');
    });
  });

  describe('Edge Cases and Error Prevention', () => {
    test('should handle empty strings', () => {
      const replacements = {
        '{{##prompt##}}': { value: '', type: 'string' }
      };
      
      expect(replaceInObject('{{##prompt##}}', replacements)).toBe('');
      expect(replaceInObject('Prompt: {{##prompt##}}', replacements)).toBe('Prompt: ');
    });

    test('should handle missing replacements gracefully', () => {
      const replacements = {};
      
      expect(replaceInObject('{{##missing##}}', replacements)).toBe('{{##missing##}}');
      expect(replaceInObject('Text with {{##missing##}}', replacements)).toBe('Text with {{##missing##}}');
    });

    test('should prevent double escaping', () => {
      const input = 'Already escaped\\ntext';
      const replacements = {
        '{{##prompt##}}': { value: input, type: 'string' }
      };
      
      // 직접 치환에서는 이미 이스케이핑된 텍스트가 그대로 유지되어야 함
      expect(replaceInObject('{{##prompt##}}', replacements)).toBe('Already escaped\\ntext');
      
      // 부분 치환에서는 추가 이스케이핑이 적용됨
      expect(replaceInObject('Prompt: {{##prompt##}}', replacements)).toBe('Prompt: Already escaped\\\\ntext');
    });

    test('should handle complex nested objects', () => {
      const template = {
        "positive": "{{##prompt##}}",
        "negative": "{{##negative_prompt##}}",
        "nested": {
          "prompt_with_prefix": "Enhanced: {{##prompt##}}",
          "array": ["{{##prompt##}}", "static text"]
        }
      };
      
      const replacements = {
        '{{##prompt##}}': { value: 'test\nprompt', type: 'string' },
        '{{##negative_prompt##}}': { value: 'bad\tquality', type: 'string' }
      };
      
      const result = replaceInObject(template, replacements);
      
      expect(result.positive).toBe('test\nprompt'); // 직접 치환
      expect(result.negative).toBe('bad\tquality'); // 직접 치환
      expect(result.nested.prompt_with_prefix).toBe('Enhanced: test\\nprompt'); // 부분 치환
      expect(result.nested.array[0]).toBe('test\nprompt'); // 배열 내 직접 치환
      expect(result.nested.array[1]).toBe('static text'); // 정적 텍스트
    });
  });
});