/**
 * 업로드 상한 두 값의 대소 가드 (#815)
 *
 * 업로드 상한은 두 곳에 있고 서로를 모른다:
 *
 *   MAX_FILE_SIZE        백엔드 multer (바이트)
 *   client_max_body_size nginx 요청 본문 (사람이 읽는 표기)
 *
 * nginx 쪽이 더 작으면 **nginx 가 먼저 413 으로 잘라낸다.** 그 오류는 백엔드에 도달하지
 * 않아 앱 로그에 아무 흔적이 없고, "`.env` 를 올렸는데 왜 안 되지" 로 이어진다.
 * 실제로 두 번 밟았다 — 커밋 5d610d5 의 제목("increase nginx client_max_body_size ...")이
 * 그 자체로 증거이고, #753 에서 참조 비디오 때문에 또 한 번 따로 올렸다.
 *
 * 지금은 150M > 30MB 라 통과에 지장이 없다. **MAX_FILE_SIZE 를 150M 이상으로 올릴 때 재발한다.**
 * 그 순간을 여기서 잡는다.
 */
const fs = require('fs');
const path = require('path');

const repo = (...p) => path.join(__dirname, '..', '..', ...p);
const read = (...p) => fs.readFileSync(repo(...p), 'utf8');

/** nginx 표기(`150M`, `1G`, `512k`, `1048576`)를 바이트로 */
function parseNginxSize(raw) {
  const m = String(raw).trim().match(/^(\d+)([kKmMgG]?)$/);
  if (!m) return null;
  const scale = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 };
  return parseInt(m[1], 10) * scale[m[2].toLowerCase()];
}

/** env 파일에서 KEY=VALUE 하나 뽑기 (주석 줄 제외) */
function envValue(file, key) {
  const line = read(file)
    .split('\n')
    .find((l) => !l.trimStart().startsWith('#') && l.trimStart().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim() : null;
}

describe('nginx 표기 파서', () => {
  test.each([
    ['150M', 150 * 1024 ** 2],
    ['1G', 1024 ** 3],
    ['512k', 512 * 1024],
    ['1048576', 1048576],
  ])('%s → %i bytes', (raw, expected) => {
    expect(parseNginxSize(raw)).toBe(expected);
  });

  test('알 수 없는 표기는 null — 조용히 0 으로 보지 않는다', () => {
    // 0 으로 떨어지면 "nginx 상한이 작다" 는 오탐이 되고, null 이면 아래 테스트가 명시적으로 실패한다
    expect(parseNginxSize('150MB')).toBeNull();
    expect(parseNginxSize('')).toBeNull();
  });
});

describe('두 상한의 대소 (#815)', () => {
  test.each(['.env.example', '.env.production.example'])('%s 의 nginx 상한이 MAX_FILE_SIZE 이상', (file) => {
    const maxFileSize = parseInt(envValue(file, 'MAX_FILE_SIZE'), 10);
    const nginxRaw = envValue(file, 'NGINX_MAX_BODY_SIZE');

    expect(Number.isFinite(maxFileSize)).toBe(true);
    expect(nginxRaw).not.toBeNull();

    const nginxBytes = parseNginxSize(nginxRaw);
    expect(nginxBytes).not.toBeNull();
    // 같아도 멀티파트 오버헤드로 걸릴 수 있으므로 크거나 같음을 요구하되, 실무상 여유를 둔다
    expect(nginxBytes).toBeGreaterThanOrEqual(maxFileSize);
  });
});

describe('설정이 단일 경로로 흐른다 (#815)', () => {
  test('nginx 설정이 하드코딩 대신 변수를 쓴다', () => {
    const tpl = read('nginx.conf.template');
    expect(tpl).toContain('client_max_body_size ${NGINX_MAX_BODY_SIZE}');
    // 하드코딩된 크기가 남아 있으면 변수 주입이 무력화된다
    expect(tpl).not.toMatch(/client_max_body_size\s+\d+[kKmMgG]?\s*;/);
  });

  test('compose 양쪽이 변수를 주입한다', () => {
    for (const f of ['docker-compose.yml', 'docker-compose.prod.yml']) {
      expect(read(f)).toContain('NGINX_MAX_BODY_SIZE');
    }
  });

  test('Dockerfile 이 템플릿 경로에 두고 envsubst 필터를 건다', () => {
    const df = read('Dockerfile.frontend');
    expect(df).toContain('/etc/nginx/templates/default.conf.template');
    // 필터가 없으면 envsubst 가 $uri · $host 같은 nginx 변수까지 치환해 설정이 망가진다
    expect(df).toContain('NGINX_ENVSUBST_FILTER');
  });
});
