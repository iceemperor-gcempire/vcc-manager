const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

describe('시크릿 미설정 시 fail-fast 동작 (F-06)', () => {
  describe('signedUrl.js — JWT_SECRET', () => {
    test('JWT_SECRET 미설정 시 모듈 로드에서 에러 발생', () => {
      expect(() => {
        execSync(
          'node -e "require(\'./src/utils/signedUrl\')"',
          {
            cwd: projectRoot,
            env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH },
            stdio: 'pipe',
          }
        );
      }).toThrow(/JWT_SECRET/);
    });

    test('JWT_SECRET 빈 문자열이어도 에러 발생', () => {
      expect(() => {
        execSync(
          'node -e "require(\'./src/utils/signedUrl\')"',
          {
            cwd: projectRoot,
            env: { PATH: process.env.PATH, JWT_SECRET: '' },
            stdio: 'pipe',
          }
        );
      }).toThrow(/JWT_SECRET/);
    });

    test('JWT_SECRET 설정 시 모듈 정상 로드', () => {
      expect(() => {
        execSync(
          'node -e "require(\'./src/utils/signedUrl\')"',
          {
            cwd: projectRoot,
            env: { PATH: process.env.PATH, JWT_SECRET: 'test-secret-for-jest' },
            stdio: 'pipe',
          }
        );
      }).not.toThrow();
    });
  });

  describe('middleware/auth.js — JWT_SECRET', () => {
    test('JWT_SECRET 미설정 시 generateJWT 호출에서 에러 발생', () => {
      expect(() => {
        execSync(
          `node -e "const { generateJWT } = require('./src/middleware/auth'); generateJWT({ _id: '1', email: 'a@b.c', isAdmin: false, authProvider: 'local' })"`,
          {
            cwd: projectRoot,
            env: { PATH: process.env.PATH, NODE_PATH: process.env.NODE_PATH },
            stdio: 'pipe',
          }
        );
      }).toThrow(/JWT_SECRET/);
    });
  });
});
