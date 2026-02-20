const fs = require('fs');
const path = require('path');

const composePath = path.resolve(__dirname, '../../docker-compose.prod.yml');
const composeContent = fs.readFileSync(composePath, 'utf-8');

describe('docker-compose.prod.yml - insecure default 제거 (F-06)', () => {
  test('MONGO_ROOT_PASSWORD에 기본값 폴백(:-) 없음', () => {
    // :-password 같은 기본값이 아닌 :?error 구문이어야 함
    expect(composeContent).not.toMatch(/\$\{MONGO_ROOT_PASSWORD:-/);
    expect(composeContent).toMatch(/\$\{MONGO_ROOT_PASSWORD:\?/);
  });

  test('REDIS_PASSWORD에 기본값 폴백(:-) 없음', () => {
    expect(composeContent).not.toMatch(/\$\{REDIS_PASSWORD:-/);
    expect(composeContent).toMatch(/\$\{REDIS_PASSWORD:\?/);
  });

  test('MONGO_ROOT_USER에 기본값 폴백(:-) 없음', () => {
    expect(composeContent).not.toMatch(/\$\{MONGO_ROOT_USER:-/);
    expect(composeContent).toMatch(/\$\{MONGO_ROOT_USER:\?/);
  });

  test('개발용 docker-compose.yml은 기본값 유지 (편의성)', () => {
    const devComposePath = path.resolve(__dirname, '../../docker-compose.yml');
    const devContent = fs.readFileSync(devComposePath, 'utf-8');
    // 개발용은 기본값 폴백이 있어야 함
    expect(devContent).toMatch(/\$\{MONGO_ROOT_PASSWORD:-/);
    expect(devContent).toMatch(/\$\{REDIS_PASSWORD:-/);
  });
});
