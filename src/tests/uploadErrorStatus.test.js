/**
 * 업로드 거부가 사용자에게 이유를 전달한다 (#842)
 *
 * fileFilter 의 거부와 multer 의 용량 초과가 전부 status 없는 Error 로 올라와,
 * errorHandler 의 500 메시지 은닉(#694)에 걸려 "Internal server error" 로 둔갑했다.
 * R2V 참조 영상 테스트(#839)에서 사용자가 3회 연속 원인 없이 막혔다.
 *
 * 고정하는 계약: (1) 세 필터의 거부는 400 + 수신 mimetype 포함 메시지,
 * (2) MulterError 는 errorHandler 가 4xx 로 매핑한다.
 */
const errorHandler = require('../middleware/errorHandler');
const handler = errorHandler.errorHandler || errorHandler;

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

/** multer 의 fileFilter(req, file, cb) 를 직접 호출해 cb 로 넘어온 오류를 얻는다 */
function filterError(filter, mimetype) {
  let captured = null;
  filter({}, { mimetype, originalname: 'x' }, (err) => { captured = err; });
  return captured;
}

describe('fileFilter 거부는 400 + 사유 (#842)', () => {
  // multer() 인스턴스는 filter 를 내부에 캡슐화하므로, 각 유틸이 filter 를 export 하는지가
  // 아니라 "거부 오류의 모양"을 본다. 유틸 내부 filter 에 접근하기 위해 모듈에서 새로 만든다.
  const cases = [
    ['videoUpload', require('../utils/videoUpload'), 'video/x-msvideo', '영상'],
    ['audioUpload', require('../utils/audioUpload'), 'audio/midi', '오디오'],
    ['fileUpload', require('../utils/fileUpload'), 'image/tiff', '이미지'],
  ];

  test.each(cases)('%s — status 400, 수신 mimetype 이 메시지에 있다', (name, mod, badMime) => {
    const filter = mod.fileFilter;
    expect(typeof filter).toBe('function');

    const err = filterError(filter, badMime);
    expect(err).toBeTruthy();
    expect(err.status).toBe(400);
    // 수신값이 없으면 "MKV 라 거부됐는지, 브라우저가 octet-stream 으로 보냈는지" 구분이 안 된다
    expect(err.message).toContain(badMime);
  });

  test.each(cases)('%s — 허용 형식은 통과', (name, mod) => {
    const ok = { videoUpload: 'video/mp4', audioUpload: 'audio/wav', fileUpload: 'image/png' }[name];
    expect(filterError(mod.fileFilter, ok)).toBeNull();
  });
});

describe('errorHandler 의 MulterError 매핑 (#842)', () => {
  const mkErr = (code) => Object.assign(new Error('boom'), { name: 'MulterError', code });

  test('LIMIT_FILE_SIZE → 413 + 상한 안내', () => {
    const res = mockRes();
    handler(mkErr('LIMIT_FILE_SIZE'), {}, res, () => {});
    expect(res.statusCode).toBe(413);
    expect(res.body.message).toContain('MB');
  });

  test('그 외 multer 오류 → 400 (500 은닉 금지)', () => {
    const res = mockRes();
    handler(mkErr('LIMIT_UNEXPECTED_FILE'), {}, res, () => {});
    expect(res.statusCode).toBe(400);
  });

  test('status 400 이 붙은 필터 오류는 메시지가 그대로 전달된다', () => {
    const res = mockRes();
    const err = Object.assign(new Error('지원하지 않는 영상 형식입니다'), { status: 400 });
    handler(err, {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('지원하지 않는');
  });
});
