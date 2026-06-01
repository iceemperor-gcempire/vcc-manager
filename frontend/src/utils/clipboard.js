// 클립보드 복사 — navigator.clipboard 가 비보안 컨텍스트(HTTP)·권한정책 등으로
// 막힌 환경에서도 동작하도록 execCommand fallback 을 제공.
// navigator.clipboard.writeText 의 drop-in 대체 (Promise 반환, 실패 시 reject).
export async function copyToClipboard(text) {
  const value = text == null ? '' : String(text);

  // 1순위: 표준 Clipboard API (보안 컨텍스트에서만 사용 가능)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (e) {
      // 권한정책 / 포커스 문제 등 — fallback 으로
    }
  }

  // 2순위: execCommand fallback (HTTP / 구형 브라우저)
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) return true;
    throw new Error('execCommand copy returned false');
  } catch (e) {
    throw new Error('클립보드 복사를 지원하지 않는 환경입니다.');
  }
}

export default copyToClipboard;
