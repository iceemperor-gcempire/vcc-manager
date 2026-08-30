import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// #841 — 생성한 오디오 탭. 업로드/생성 API 를 탭에 따라 부르고, 선택 결과에 audioType 이 실린다.
vi.mock('../../services/api', () => ({
  imageAPI: {
    getUploadedAudios: vi.fn().mockResolvedValue({ data: { audios: [{ _id: 'up-1', originalName: 'wind.mp3', url: '/u/wind.mp3', metadata: { duration: 61 } }], pagination: { pages: 1 } } }),
    getAudios: vi.fn().mockResolvedValue({ data: { audios: [{ _id: 'gen-1', originalName: 'song.mp3', url: '/g/song.mp3', metadata: { duration: 125 } }], pagination: { pages: 1 } } }),
  },
}));

import AudioSelectDialog from './AudioSelectDialog';
import { imageAPI } from '../../services/api';

describe('AudioSelectDialog 생성한 오디오 탭 (#841)', () => {
  beforeEach(() => vi.clearAllMocks());

  test('기본은 업로드 탭, 생성 탭으로 바꾸면 getAudios 를 부르고 선택 결과에 audioType=generated', async () => {
    const onSelect = vi.fn(); const onClose = vi.fn();
    render(<AudioSelectDialog open onClose={onClose} onSelect={onSelect} />);
    expect(await screen.findByText('wind.mp3')).toBeInTheDocument();
    expect(imageAPI.getUploadedAudios).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: '생성한 오디오' }));
    expect(await screen.findByText('song.mp3')).toBeInTheDocument();
    expect(imageAPI.getAudios).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    fireEvent.click(screen.getByText('song.mp3'));
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    const picked = onSelect.mock.calls[0][0];
    expect(picked.audioId).toBe('gen-1');
    expect(picked.audioType).toBe('generated');
    expect(picked.audio.url).toBe('/g/song.mp3');
  });

  test('생성 탭 빈 목록 문구', async () => {
    imageAPI.getAudios.mockResolvedValueOnce({ data: { audios: [], pagination: { pages: 1 } } });
    render(<AudioSelectDialog open onClose={() => {}} onSelect={() => {}} />);
    await screen.findByText('wind.mp3');
    fireEvent.click(screen.getByRole('tab', { name: '생성한 오디오' }));
    expect(await screen.findByText('생성한 오디오가 없습니다')).toBeInTheDocument();
  });
});
