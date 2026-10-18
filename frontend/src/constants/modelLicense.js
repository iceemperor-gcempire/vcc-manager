// 모델 라이선스 (#1073) — 백엔드 src/constants/modelLicense.js 의 mirror (값 목록·길이 상한).
// 검증과 "어느 모델에 어느 라이선스가 붙는지" 판정은 백엔드가 한다. 여기 값은 입력 화면과 표시용.
// 바꾸면 백엔드도 함께 — src/tests/modelLicense.test.js 가 어긋남을 잡는다.
export const COMMERCIAL_USE = ['allowed', 'conditional', 'prohibited'];

export const MODEL_LICENSE_LIMITS = {
  name: 100,
  url: 500,
  note: 200,
  targets: 50,
  target: 300,
};

// 화면 문구 — 이건 프런트가 정한다
export const COMMERCIAL_USE_LABELS = {
  allowed: '상업적 이용 가능',
  conditional: '상업적 이용 조건부',
  prohibited: '상업적 이용 불가',
};

export const COMMERCIAL_USE_COLORS = {
  allowed: 'success',
  conditional: 'warning',
  prohibited: 'error',
};

// 붙은 라이선스가 없을 때 — 비워 두면 "확인 안 한 모델"과 "제한 없는 모델"이 구분되지 않는다
export const UNREGISTERED_LICENSE_LABEL = '라이선스 미등록';
