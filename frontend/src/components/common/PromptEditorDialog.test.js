import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PromptEditorDialog from './PromptEditorDialog';

describe('PromptEditorDialog (#900)', () => {
  test('열릴 때 현재 값이 들어 있고, 편집 후 저장하면 onSave 에 새 값', () => {
    const onSave = vi.fn(); const onClose = vi.fn();
    render(<PromptEditorDialog open title="프롬프트 편집" value="a cat" onClose={onClose} onSave={onSave} />);
    const ta = screen.getByRole('textbox', { name: '프롬프트 편집' });
    expect(ta.value).toBe('a cat');
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();   // 변경 없음
    fireEvent.change(ta, { target: { value: 'a cat\non a roof' } });
    expect(screen.getByText('15자 · 2줄')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledWith('a cat\non a roof');
  });

  test('취소하면 onSave 를 부르지 않는다', () => {
    const onSave = vi.fn(); const onClose = vi.fn();
    render(<PromptEditorDialog open value="a cat" onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByRole('textbox', { name: '프롬프트 편집' }), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('Ctrl+Enter 로 저장', () => {
    const onSave = vi.fn();
    render(<PromptEditorDialog open value="" onClose={() => {}} onSave={onSave} />);
    const ta = screen.getByRole('textbox', { name: '프롬프트 편집' });
    fireEvent.change(ta, { target: { value: 'x' } });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('x');
  });
});
