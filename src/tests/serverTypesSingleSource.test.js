/**
 * #745 — serverType 단일 source (constants/serverTypes.js) 정합성 테스트.
 *
 * 타입 목록·capability 가 소비처와 어긋나는 회귀를 잡는다:
 * 1. capability matrix ↔ queueService SERVICE_MAP 커버리지
 * 2. 파생 목록(deprecated 포함/제외, legacy fallback) 불변식
 *
 * frontend/mcp mirror 동기화 테스트는 serverTypesMirror.test.js (Phase 2) 참고.
 */
const {
  SERVER_TYPE_SPECS,
  DEPRECATED_SERVER_TYPE_SPECS,
  SERVER_TYPES,
  SERVER_TYPES_WITH_DEPRECATED,
  MODEL_SYNC_SERVER_TYPES,
  SERVER_TYPE_LEGACY_FALLBACK,
  getServerTypeSpec,
} = require('../constants/serverTypes');
const { SERVICE_MAP } = require('../services/queueService');

describe('serverTypes 단일 source 정합성 (#745)', () => {
  test('image/video capability 는 SERVICE_MAP 에 핸들러가 있어야 함', () => {
    // 'text' 는 Bull 큐를 타지 않는 동기 SSE 경로라 SERVICE_MAP 대상 아님.
    for (const [serverType, spec] of Object.entries(SERVER_TYPE_SPECS)) {
      for (const format of spec.outputFormats) {
        if (format === 'text') continue;
        const key = `${serverType}:${format}`;
        expect(SERVICE_MAP[key]).toBeInstanceOf(Function);
      }
    }
  });

  test('SERVICE_MAP 의 키는 전부 유효한 serverType 을 참조', () => {
    // capability 에 없는 잉여 키는 허용(구버전 작업판 호환)하되,
    // 존재하지 않는 타입을 참조하는 키는 오타이므로 실패시킨다.
    for (const key of Object.keys(SERVICE_MAP)) {
      const [serverType, format] = key.split(':');
      expect(SERVER_TYPES).toContain(serverType);
      expect(['image', 'video', 'audio']).toContain(format);   // #805
    }
  });

  test('활성 타입 목록에 deprecated 타입이 섞이지 않음', () => {
    for (const deprecatedType of Object.keys(DEPRECATED_SERVER_TYPE_SPECS)) {
      expect(SERVER_TYPES).not.toContain(deprecatedType);
      expect(SERVER_TYPES_WITH_DEPRECATED).toContain(deprecatedType);
    }
  });

  test('deprecated 타입의 migrateTo 는 활성 타입이며 legacy fallback 과 일치', () => {
    for (const [deprecatedType, spec] of Object.entries(DEPRECATED_SERVER_TYPE_SPECS)) {
      expect(SERVER_TYPES).toContain(spec.migrateTo);
      expect(SERVER_TYPE_LEGACY_FALLBACK[deprecatedType]).toBe(spec.migrateTo);
    }
  });

  test('modelSource 가 있는 타입만 MODEL_SYNC_SERVER_TYPES 에 포함', () => {
    const expected = SERVER_TYPES.filter((t) => SERVER_TYPE_SPECS[t].modelSource);
    expect(MODEL_SYNC_SERVER_TYPES).toEqual(expected);
  });

  test('getServerTypeSpec 은 deprecated 타입도 healthCheck spec 을 반환', () => {
    for (const serverType of SERVER_TYPES_WITH_DEPRECATED) {
      const spec = getServerTypeSpec(serverType);
      expect(spec).not.toBeNull();
      expect(spec.healthCheck).toBeDefined();
      expect(typeof spec.healthCheck.path).toBe('string');
    }
    expect(getServerTypeSpec('없는타입')).toBeNull();
  });
});
