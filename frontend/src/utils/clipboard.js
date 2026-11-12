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
  // 임시 textarea 는 지금 포커스가 있는 창(role="dialog") 안에 붙인다 (#1187). MUI Dialog 는
  // 포커스를 창 안에 가둬서, body 에 붙이면 textarea 로 간 포커스를 곧바로 창으로 되돌린다.
  // 그러면 선택이 풀린 채 빈 내용이 복사되는데 execCommand 는 그래도 true 를 돌려줬다.
  const active = document.activeElement;
  const host = (active && typeof active.closest === 'function' && active.closest('[role="dialog"]')) || document.body;
  let ta = null;
  try {
    ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    host.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    if (ok) return true;
    throw new Error('execCommand copy returned false');
  } catch (e) {
    throw new Error('클립보드 복사를 지원하지 않는 환경입니다.');
  } finally {
    if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
    // 누른 버튼으로 포커스를 돌려 둔다 (키보드 사용자·창의 포커스 순서 유지)
    if (active && active !== document.activeElement && typeof active.focus === 'function') {
      try { active.focus({ preventScroll: true }); } catch { /* 이미 사라진 요소 */ }
    }
  }
}

export default copyToClipboard;
