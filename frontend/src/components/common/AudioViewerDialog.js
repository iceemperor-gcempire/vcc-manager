import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { Close, MusicNote } from '@mui/icons-material';
import { MONO } from '../../theme';

// 생성 오디오 뷰어 (#805) — VideoViewerDialog 와 대칭이되 훨씬 단순하다.
//
// 오디오는 썸네일도 전체화면도 의미가 없어 좌우 이동 UI 를 두지 않고
// 한 작업의 결과물을 **전부 나열해 각각 재생**하게 한다. 대개 1~2개다.
const formatDuration = (seconds) => {
  if (seconds == null) return '길이 미상';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function AudioViewerDialog({ audios = [], open, onClose, title = '생성된 오디오' }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MusicNote fontSize="small" color="action" />
        <Box sx={{ flex: 1 }}>{title}</Box>
        <IconButton aria-label="닫기" onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {audios.length === 0 ? (
          <Typography variant="body2" color="text.secondary">오디오가 없습니다.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {audios.map((audio, index) => (
              <Box key={audio._id || index}>
                <Typography variant="body2" noWrap title={audio.generationParams?.prompt || audio.originalName}>
                  {audio.generationParams?.prompt || audio.originalName || `오디오 ${index + 1}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
                  {formatDuration(audio.metadata?.duration)}
                  {audio.metadata?.channels ? ` · ${audio.metadata.channels}ch` : ''}
                  {audio.metadata?.sampleRate ? ` · ${Math.round(audio.metadata.sampleRate / 1000)}kHz` : ''}
                </Typography>
                <Box
                  component="audio"
                  controls
                  autoPlay={index === 0}
                  src={audio.url}
                  sx={{ display: 'block', width: '100%', mt: 0.5 }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AudioViewerDialog;
