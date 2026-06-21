/**
 * #637 BACKUP_HOST_PATH — backups 마운트가 named volume ↔ host bind 로 전환되는지 검증.
 * docker compose config 출력을 파싱해 마운트 타입을 확인 (docker 없으면 skip).
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV = path.join(ROOT, '.env.production.example');

function hasDocker() {
  try { execSync('docker compose version', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function backupsMountType(extraEnv) {
  const out = execSync(
    `docker compose -f docker-compose.prod.yml --env-file ${ENV} config`,
    { cwd: ROOT, env: { ...process.env, ...extraEnv }, encoding: 'utf8' }
  );
  // backups 마운트 블록에서 target: /app/backups 직전의 type/source 추출
  const lines = out.split('\n');
  const idx = lines.findIndex((l) => l.includes('target: /app/backups'));
  if (idx < 0) return null;
  const block = lines.slice(Math.max(0, idx - 3), idx + 1).join('\n');
  const type = (block.match(/type:\s*(\w+)/) || [])[1];
  const source = (block.match(/source:\s*(\S+)/) || [])[1];
  return { type, source };
}

const d = hasDocker();
const maybe = d ? describe : describe.skip;

maybe('#637 BACKUP_HOST_PATH 마운트 전환', () => {
  test('미설정 → named volume(backups_data)', () => {
    const m = backupsMountType({ BACKUP_HOST_PATH: '' });
    expect(m.type).toBe('volume');
    expect(m.source).toBe('backups_data');
  });

  test('절대경로 설정 → host bind mount', () => {
    const m = backupsMountType({ BACKUP_HOST_PATH: '/mnt/backup-disk/vcc-backups' });
    expect(m.type).toBe('bind');
    expect(m.source).toBe('/mnt/backup-disk/vcc-backups');
  });
});

if (!d) {
  test('docker 미설치 — compose 전환 테스트 skip', () => {
    expect(true).toBe(true);
  });
}
