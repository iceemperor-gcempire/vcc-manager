/**
 * 작업판 즐겨찾기 별 (#1216)
 *
 * 사용자 목록 카드는 카드 전체가 "판 열기" 클릭 영역이다. 별을 누르면 즐겨찾기만 바뀌고 판이 열리면 안 된다.
 * 관리 화면 카드에는 별이 없다.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { WorkboardCard } from './WorkboardCatalog';

const wb = { _id: 'w1', name: 'Krea 2 - T2I', outputFormat: 'image', serverId: { name: 'ComfyUI', serverType: 'ComfyUI' }, isActive: true };

describe('작업판 즐겨찾기 별 (#1216)', () => {
  test('별을 누르면 토글만 하고 카드(판 열기)는 누르지 않는다', () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<WorkboardCard wb={wb} admin={false} onClick={onOpen} favorite={{ active: false, onToggle }} />);

    const star = screen.getByRole('button', { name: '즐겨찾기 추가' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('즐겨찾기한 판은 "해제" 로 보인다', () => {
    render(<WorkboardCard wb={wb} admin={false} onClick={() => {}} favorite={{ active: true, onToggle: () => {} }} />);
    expect(screen.getByRole('button', { name: '즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('관리 화면 카드와 favorite 를 넘기지 않은 카드에는 별이 없다', () => {
    const { unmount } = render(<WorkboardCard wb={wb} admin onEdit={() => {}} onMenu={() => {}} />);
    expect(screen.queryByRole('button', { name: /즐겨찾기/ })).toBeNull();
    unmount();
    render(<WorkboardCard wb={wb} admin={false} onClick={() => {}} />);
    expect(screen.queryByRole('button', { name: /즐겨찾기/ })).toBeNull();
  });
});
