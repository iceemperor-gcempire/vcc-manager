/**
 * 비밀번호 정책 단일 소스 (#663).
 * signup/reset-password/change 가 각자 정규식을 두면 drift 가 생기므로 한 곳에서 관리.
 * 정책: 8자 이상 + 소문자 + 대문자 + 숫자 + 특수문자(!@#$%^&*).
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상이며, 대문자, 소문자, 숫자, 특수문자(!@#$%^&*)를 포함해야 합니다';

function isValidPassword(password) {
  return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

module.exports = { PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE, isValidPassword };
