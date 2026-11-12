/**
 * 첨부 칸 → 갤러리 연결 (#1182)
 *
 * AI 프롬프트 생성의 첨부 칸 세 곳(단발 패널·작업판 대화·대화 이어가기)이 이 컴포넌트 하나를 쓴다.
 * 갤러리에 넘기는 값(남은 자리·처음 선택)과 고른 결과가 첨부 목록으로 돌아오는 길을 고정한다.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';

// ImageSelectDialog 를 가로채 넘어온 props 만 기록한다 — 목록 조회 없이 계약을 본다.
const dialogProps = [];
vi.mock('./ImageSelectDialog', () => ({
  default: (props) => {
    dialogProps.push(props);
    return null;
  },
}));

import ImageUploadField from './ImageUploadField';

const lastDialog = () => dialogProps[dialogProps.length - 1];
const file = (name) => ({ file: { name }, preview: `blob:${name}` });
const existing = (id) => ({ _id: id, url: `/api/files/${id}` });

beforeEach(() => {
  dialogProps.length = 0;
});

describe('ImageUploadField 갤러리에서 선택 (#1182)', () => {
  test('버튼을 누르면 갤러리가 열리고, 남은 자리와 이미 고른 이미지를 넘긴다', () => {
    render(
      <ImageUploadField label="참고 이미지" images={[file('a'), existing('x')]} onImagesChange={() => {}} maxImages={3} />
    );
    expect(lastDialog().open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /갤러리에서 선택/ }));

    const p = lastDialog();
    expect(p.open).toBe(true);
    expect(p.maxImages).toBe(2);
    expect(p.multiple).toBe(true);
    expect(p.initialSelected).toEqual([{ imageId: 'x', image: { _id: 'x', url: '/api/files/x' } }]);
    // 칸 이름과 무관한 고정 제목 — "이미지 (선택)" 칸이면 "이미지 (선택) 선택" 이 됐다 (#1184)
    expect(p.title).toBe('첨부할 이미지 선택');
  });

  test('남은 자리가 하나면 단일 선택으로 연다', () => {
    render(<ImageUploadField label="첨부" images={[]} onImagesChange={() => {}} maxImages={1} />);
    expect(lastDialog().multiple).toBe(false);
    expect(lastDialog().maxImages).toBe(1);
  });

  test('고른 결과가 첨부 목록으로 돌아온다 — 새 파일은 그대로, 기존 이미지는 { _id, url }', () => {
    const onImagesChange = vi.fn();
    const a = file('a');
    render(<ImageUploadField label="첨부" images={[a]} onImagesChange={onImagesChange} maxImages={3} />);

    act(() => {
      lastDialog().onSelect([
        { imageId: 'g1', imageType: 'GeneratedImage', image: { _id: 'g1', url: '/api/files/g1' } },
        { imageId: 'u1', imageType: 'UploadedImage', image: { _id: 'u1', url: '/api/files/u1' } },
      ]);
    });

    expect(onImagesChange).toHaveBeenCalledWith([a, existing('g1'), existing('u1')]);
  });

  test('비활성(전송 중)이면 버튼도 갤러리도 없다', () => {
    render(<ImageUploadField label="첨부" images={[]} onImagesChange={() => {}} maxImages={3} disabled />);
    expect(screen.queryByRole('button', { name: /갤러리에서 선택/ })).toBeNull();
    expect(dialogProps).toHaveLength(0);
  });

  test('새 파일로 자리가 다 차면 버튼이 없다', () => {
    render(<ImageUploadField label="첨부" images={[file('a'), file('b')]} onImagesChange={() => {}} maxImages={2} />);
    expect(screen.queryByRole('button', { name: /갤러리에서 선택/ })).toBeNull();
  });

  test('기존 이미지로 다 찼으면 버튼이 남는다 — 열어서 바꿀 수 있다', () => {
    render(<ImageUploadField label="첨부" images={[existing('x'), existing('y')]} onImagesChange={() => {}} maxImages={2} />);
    expect(screen.getByRole('button', { name: /갤러리에서 선택/ })).toBeInTheDocument();
    expect(lastDialog().maxImages).toBe(2);
  });
});
