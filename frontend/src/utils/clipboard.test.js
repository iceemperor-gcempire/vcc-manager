import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

// 비보안(HTTP) 접속의 대체 경로 (#477, #1187).
// MUI Dialog 의 포커스 가두기를 흉내 낸다: 창 밖 요소가 포커스를 받으면 곧바로 창으로 되돌린다.
// 임시 textarea 를 body 에 붙이던 예전 구현은 이 상태에서 빈 내용을 복사하고도 성공을 돌려줬다.

let seen;
const originalExec = document.execCommand;

function selectionAtCopy() {
  const a = document.activeElement;
  const isField = a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT');
  return {
    // 복사 순간에 잰다 — textarea 는 끝나면 치워져 나중에는 창 안에 있었는지 알 수 없다
    inDialog: !!(a && a.closest && a.closest('[role="dialog"]')),
    text: isField ? a.value.slice(a.selectionStart, a.selectionEnd) : '',
  };
}

function makeDialogWithButton() {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const button = document.createElement('button');
  button.textContent = '복사';
  dialog.appendChild(button);
  document.body.appendChild(dialog);
  // 포커스 가두기 — 창 밖으로 포커스가 나가면 창 안 버튼으로 되돌린다 (MUI FocusTrap 과 같은 동작)
  const trap = (e) => { if (!dialog.contains(e.target)) button.focus(); };
  document.addEventListener('focusin', trap);
  button.focus();
  return { dialog, button, release: () => document.removeEventListener('focusin', trap) };
}

describe('copyToClipboard — execCommand 대체 경로', () => {
  beforeEach(() => {
    seen = null;
    // jsdom 은 보안 컨텍스트가 아니고 navigator.clipboard 도 없다 → 대체 경로를 탄다
    document.execCommand = vi.fn(() => { seen = selectionAtCopy(); return true; });
  });
  afterEach(() => {
    document.execCommand = originalExec;
    document.body.innerHTML = '';
  });

  it('포커스를 가두는 창 안에서 불러도 값 전체가 선택된 채 복사된다', async () => {
    const { release } = makeDialogWithButton();
    await copyToClipboard('vccm_abc123');
    release();

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(seen.text).toBe('vccm_abc123');
    expect(seen.inDialog).toBe(true);
  });

  it('끝나면 임시 textarea 를 치우고 포커스를 누른 버튼으로 돌린다', async () => {
    const { button, release } = makeDialogWithButton();
    await copyToClipboard('abc');
    release();

    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    expect(document.activeElement).toBe(button);
  });

  it('창이 없으면 body 에 붙여 복사한다', async () => {
    await copyToClipboard('plain');
    expect(seen.text).toBe('plain');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('execCommand 가 false 면 실패로 알리고 textarea 를 남기지 않는다', async () => {
    document.execCommand = vi.fn(() => false);
    await expect(copyToClipboard('x')).rejects.toThrow('클립보드 복사를 지원하지 않는 환경입니다.');
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});
