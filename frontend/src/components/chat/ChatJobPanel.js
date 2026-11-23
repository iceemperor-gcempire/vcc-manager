import React, { useState } from 'react';
import { Box, Typography, LinearProgress, Button, Tooltip, IconButton } from '@mui/material';
import { AttachFile, PlayArrow, History } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ToneChip from '../common/ToneChip';
import ImageViewerDialog from '../common/ImageViewerDialog';
import VideoViewerDialog from '../common/VideoViewerDialog';
import { isJobActive, jobResults } from '../../utils/chatView';

const STATUS = {
  pending: { tone: 'info', label: '대기 중' },
  processing: { tone: 'accent', label: '만드는 중' },
  completed: { tone: 'success', label: '완료' },
  failed: { tone: 'error', label: '실패' },
  cancelled: { tone: undefined, label: '취소됨' },
};
const OUTPUT_LABEL = { image: '이미지', video: '영상', audio: '오디오' };

function JobCard({ job, onAttach, canAttach, onView }) {
  const status = STATUS[job.status] || { tone: undefined, label: job.status || '' };
  const results = jobResults(job);
  const prompt = job.inputData?.prompt || '';
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>
          {job.workboardId?.name || '작업판'}
        </Typography>
        <ToneChip tone={status.tone} label={status.label} />
      </Box>
      <Typography variant="caption" sx={{ color: 'text.tertiary', display: 'block' }}>
        {OUTPUT_LABEL[job.workboardId?.outputFormat] || '생성'} 작업
      </Typography>
      {prompt && (
        <Typography variant="body2" sx={{
          mt: 1.5, color: 'text.secondary', fontSize: 12.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
        }}>
          {prompt}
        </Typography>
      )}
      {isJobActive(job) && (
        <LinearProgress
          sx={{ mt: 2, borderRadius: 1 }}
          variant={job.status === 'processing' && job.progress > 0 ? 'determinate' : 'indeterminate'}
          value={job.progress || 0}
        />
      )}
      {job.status === 'failed' && job.error?.message && (
        <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1.5, wordBreak: 'break-word' }}>
          {job.error.message}
        </Typography>
      )}
      {results.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 2, mt: 2 }}>
          {results.map(({ type, media }) => (
            <Box key={media._id} sx={{ position: 'relative', minWidth: 0 }}>
              {type === 'audio' ? (
                <audio src={media.url} controls style={{ width: '100%' }} />
              ) : (
                <Box
                  role="button" tabIndex={0} aria-label={type === 'video' ? '영상 크게 보기' : '이미지 크게 보기'}
                  onClick={() => onView(job, type, media)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onView(job, type, media); }}
                  sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', cursor: 'pointer', bgcolor: 'action.hover' }}
                >
                  {type === 'video' ? (
                    <>
                      <video src={media.url} poster={media.thumbnailUrl || undefined} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <PlayArrow sx={{ position: 'absolute', inset: 0, m: 'auto', color: 'common.white', fontSize: 32, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.6))' }} />
                    </>
                  ) : (
                    <img src={media.url} alt="만든 이미지" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </Box>
              )}
              {type === 'image' && (
                <Tooltip title={canAttach ? '다음 메시지에 붙이기' : '더 붙일 수 없습니다'}>
                  <span style={{ position: 'absolute', right: 4, bottom: 4 }}>
                    <IconButton
                      size="small" aria-label="다음 메시지에 붙이기" disabled={!canAttach}
                      onClick={() => onAttach({ imageId: media._id, url: media.url })}
                      sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.paper' }, '&.Mui-disabled': { bgcolor: 'background.paper' } }}
                    >
                      <AttachFile sx={{ fontSize: 14 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// 채팅 화면 오른쪽 — 작업 상황 패널 (#1288). 대화 상대 판과, 이 대화에서 만든 작업의 판·상태·결과물.
// 작업은 보통 작업이라 작업 히스토리에도 그대로 있다.
export default function ChatJobPanel({ partner, jobs, onAttach, canAttach }) {
  const navigate = useNavigate();
  const [viewer, setViewer] = useState(null); // { type, items, index }

  const handleView = (job, type, media) => {
    const items = type === 'video' ? (job.resultVideos || []) : (job.resultImages || []);
    setViewer({ type, items, index: Math.max(items.findIndex((m) => m._id === media._id), 0) });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="overline" sx={{ color: 'text.tertiary', display: 'block' }}>대화 상대</Typography>
        <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700 }}>{partner?.name || '—'}</Typography>
        {partner?.model && (
          <Typography noWrap variant="caption" sx={{ color: 'text.tertiary', display: 'block' }}>{partner.model}</Typography>
        )}
      </Box>
      <Box sx={{ px: 3, pt: 3, display: 'flex', alignItems: 'center' }}>
        <Typography variant="overline" sx={{ color: 'text.tertiary', flex: 1 }}>
          이 대화에서 만든 작업 {jobs.length > 0 ? `(${jobs.length})` : ''}
        </Typography>
        <Button size="small" startIcon={<History sx={{ fontSize: 14 }} />} onClick={() => navigate('/jobs')}>작업 히스토리</Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {jobs.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.tertiary', textAlign: 'center', py: 6 }}>
            아직 만든 것이 없습니다. “고양이 그림 그려 줘”처럼 말해 보세요.
          </Typography>
        )}
        {[...jobs].reverse().map((job) => (
          <JobCard key={job._id} job={job} onAttach={onAttach} canAttach={canAttach} onView={handleView} />
        ))}
      </Box>

      <ImageViewerDialog
        open={viewer?.type === 'image'}
        images={viewer?.type === 'image' ? viewer.items : []}
        selectedIndex={viewer?.index || 0}
        onClose={() => setViewer(null)}
      />
      <VideoViewerDialog
        open={viewer?.type === 'video'}
        videos={viewer?.type === 'video' ? viewer.items : []}
        selectedIndex={viewer?.index || 0}
        onClose={() => setViewer(null)}
      />
    </Box>
  );
}
