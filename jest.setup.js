// Jest 공통 테스트 환경 (#535)
// secretFailFast(#379 계열) 가 요구하는 필수 env — 미설정 시 모듈 로드 단계에서 throw 되어
// filesRoute/restorePathValidation 등 17+21건이 환경 문제로 실패했었다.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-test-secret-not-for-production';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
