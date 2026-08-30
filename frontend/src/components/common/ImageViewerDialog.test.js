import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageViewerDialog from './ImageViewerDialog';

// #894 — 다음 이미지 로드 전에는 스피너가 보이고, load 이벤트 후 사라진다.
// (이전엔 로드 전 <img> 가 빈 채로 레이아웃돼 다이얼로그가 쪼그라들었다)
const images = [
  { url: '/api/files/generated/a.png', metadata: { width: 1216, height: 832 } },
  { url: '/api/files/generated/b.png', metadata: { width: 2432, height: 1664 } },
];

describe('ImageViewerDialog 로딩 표시 (#894)', () => {
  test('로드 전 스피너 → load 후 사라짐', () => {
    render(<ImageViewerDialog images={images} selectedIndex={0} open onClose={() => {}} />);
    expect(screen.getByLabelText('이미지 불러오는 중')).toBeInTheDocument();
    fireEvent.load(screen.getByAltText('Image 1'));
    expect(screen.queryByLabelText('이미지 불러오는 중')).not.toBeInTheDocument();
  });

  test('두 번째 이미지로 넘기면 그 이미지 로드 전까지 다시 스피너', () => {
    render(<ImageViewerDialog images={images} selectedIndex={0} open onClose={() => {}} />);
    fireEvent.load(screen.getByAltText('Image 1'));
    // 하단 썸네일(Avatar) 두 번째 클릭
    const thumbs = document.querySelectorAll('.MuiAvatar-root');
    fireEvent.click(thumbs[1]);
    expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    expect(screen.getByLabelText('이미지 불러오는 중')).toBeInTheDocument();
    fireEvent.load(screen.getByAltText('Image 2'));
    expect(screen.queryByLabelText('이미지 불러오는 중')).not.toBeInTheDocument();
  });

  test('이미 로드된 이미지로 돌아오면 스피너 없음', () => {
    render(<ImageViewerDialog images={images} selectedIndex={0} open onClose={() => {}} />);
    fireEvent.load(screen.getByAltText('Image 1'));
    const thumbs = document.querySelectorAll('.MuiAvatar-root');
    fireEvent.click(thumbs[1]);
    fireEvent.click(thumbs[0]);
    expect(screen.queryByLabelText('이미지 불러오는 중')).not.toBeInTheDocument();
  });
});
