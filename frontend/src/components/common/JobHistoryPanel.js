import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Button,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  Avatar
} from '@mui/material';
import {
  Search,
  Refresh,
  PlayArrow,
  Stop,
  Delete,
  Info,
  Close,
  Image as ImageIcon,
  Schedule,
  CheckCircle,
  Error as ErrorIcon,
  Cancel,
  Save,
  Videocam,
  SwapHoriz
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { jobAPI, workboardAPI, promptDataAPI, userAPI, tagAPI } from '../../services/api';
import config from '../../config';
import Pagination from './Pagination';
import ImageSelectDialog from './ImageSelectDialog';
import ImageViewerDialog from './ImageViewerDialog';
import VideoViewerDialog from './VideoViewerDialog';
import ProjectTagChip from './ProjectTagChip';
import WorkboardSelectDialog from './WorkboardSelectDialog';

function SavePromptDialog({ open, onClose, job, onSave }) {
  const [imageSelectOpen, setImageSelectOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      memo: '',
      prompt: job?.inputData?.prompt || '',
      negativePrompt: job?.inputData?.negativePrompt || '',
      seed: job?.inputData?.seed || ''
    }
  });

  React.useEffect(() => {
    if (open && job) {
      reset({
        name: '',
        memo: '',
        prompt: job.inputData?.prompt || '',
        negativePrompt: job.inputData?.negativePrompt || '',
        seed: job.inputData?.seed || ''
      });
      if (job.resultImages?.length > 0) {
        const lastImage = job.resultImages[job.resultImages.length - 1];
        setSelectedImage({
          imageId: lastImage._id,
          imageType: 'GeneratedImage',
          url: lastImage.url
        });
      } else {
        setSelectedImage(null);
      }
    }
  }, [open, job, reset]);

  // 작업의 태그 추출
  const jobTags = job?.inputData?.tags || [];
  // tags가 populate된 객체 배열인지, 아니면 ID 문자열 배열인지 확인
  const tagsArePopulated = jobTags.length > 0 && typeof jobTags[0] === 'object';

  // populate되지 않은 경우에만 태그 정보 조회
  const { data: allTagsData } = useQuery(
    'allTags',
    () => tagAPI.getAll({ limit: 200 }),
    { enabled: open && jobTags.length > 0 && !tagsArePopulated }
  );
  const allTags = allTagsData?.data?.tags || [];

  const resolvedJobTags = tagsArePopulated
    ? jobTags
    : jobTags.map(tagId => {
        const found = allTags.find(t => t._id === tagId);
        return found || { _id: tagId, name: tagId, color: '#1976d2' };
      });

  // 태그 ID 배열 (프롬프트 저장 시 전달용)
  const tagIds = tagsArePopulated ? jobTags.map(t => t._id) : jobTags;

  const onSubmit = (data) => {
    onSave({
      ...data,
      seed: data.seed ? parseInt(data.seed) : undefined,
      representativeImage: selectedImage,
      ...(tagIds.length > 0 && { tags: tagIds })
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>프롬프트 데이터로 저장</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" gutterBottom>대표 이미지</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 150,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    bgcolor: 'grey.50'
                  }}
                  onClick={() => setImageSelectOpen(true)}
                >
                  {selectedImage?.url ? (
                    <img
                      src={selectedImage.url}
                      alt="Representative"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box textAlign="center">
                      <ImageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                      <Typography variant="caption" color="textSecondary" display="block">
                        클릭하여 선택
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>

              <Grid item xs={12} sm={8}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: '이름을 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="이름"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="memo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={2}
                      label="메모"
                      placeholder="이 프롬프트에 대한 메모..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="prompt"
                  control={control}
                  rules={{ required: '프롬프트를 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="프롬프트"
                      error={!!errors.prompt}
                      helperText={errors.prompt?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="negativePrompt"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={2}
                      label="부정 프롬프트"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="seed"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="시드 (선택사항)"
                    />
                  )}
                />
              </Grid>

              {resolvedJobTags.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    프로젝트 태그 (자동 적용)
                  </Typography>
                  <Box display="flex" gap={0.5}>
                    {resolvedJobTags.map((tag) => (
                      <ProjectTagChip key={tag._id} tag={tag} />
                    ))}
                  </Box>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>취소</Button>
            <Button type="submit" variant="contained">저장</Button>
          </DialogActions>
        </form>
      </Dialog>

      <ImageSelectDialog
        open={imageSelectOpen}
        onClose={() => setImageSelectOpen(false)}
        onSelect={setSelectedImage}
        title="대표 이미지 선택"
      />
    </>
  );
}

function JobStatusChip({ status }) {
  const statusConfig = {
    pending: { color: 'warning', label: '대기중', icon: <Schedule fontSize="small" /> },
    processing: { color: 'info', label: '처리중', icon: <PlayArrow fontSize="small" /> },
    completed: { color: 'success', label: '완료', icon: <CheckCircle fontSize="small" /> },
    failed: { color: 'error', label: '실패', icon: <ErrorIcon fontSize="small" /> },
    cancelled: { color: 'default', label: '취소됨', icon: <Cancel fontSize="small" /> }
  };

  const cfg = statusConfig[status] || statusConfig.pending;

  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size="small"
      icon={cfg.icon}
      variant="outlined"
    />
  );
}

function JobCard({ job, onView, onRetry, onCancel, onDelete, onImageView, onContinue, onCrossWorkboard, onSavePrompt, readOnly = false, showTags = true }) {
  const canCancel = ['pending', 'processing'].includes(job.status);
  const canRetry = job.status === 'failed';
  const canContinue = ['completed', 'failed'].includes(job.status);
  const isProcessing = job.status === 'processing';

  const formatDuration = (ms) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  };

  // 태그 표시 (populate된 객체 배열)
  const tags = showTags ? (job.inputData?.tags || []) : [];
  const populatedTags = tags.filter(t => typeof t === 'object' && t.name);

  return (
    <Card sx={{
      mb: { xs: 1.5, md: 1 },
      '&:hover': { boxShadow: 2 },
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <CardContent sx={{
        p: { xs: 1.5, sm: 2 },
        '&:last-child': { pb: { xs: 1.5, sm: 2 } }
      }}>
        <Box mb={{ xs: 1.5, md: 1 }}>
          <Box display="flex" alignItems="flex-start" gap={1} mb={0.5}>
            <Typography
              variant="subtitle1"
              sx={{
                flex: 1,
                lineHeight: 1.3,
                mb: 0,
                wordBreak: 'break-word',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {job.inputData?.prompt || '프롬프트 없음'}
            </Typography>
            <JobStatusChip status={job.status} />
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              작업판: {job.workboardId?.name || '알 수 없음'}
            </Typography>
            {populatedTags.length > 0 && (
              <Box display="flex" gap={0.5} flexWrap="wrap">
                {populatedTags.map((tag) => (
                  <ProjectTagChip key={tag._id} tag={tag} size="small" />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {isProcessing && (
          <Box mb={1.5}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption">진행률</Typography>
              <Typography variant="caption">{job.progress || 0}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={job.progress || 0}
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        )}

        {/* 생성된 이미지들 */}
        {job.resultImages?.length > 0 && (
          <Box mb={{ xs: 1.5, md: 1 }}>
            <Typography variant="caption" display="block" gutterBottom>
              생성된 이미지 ({job.resultImages.length}개)
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '100%', overflow: 'hidden' }}>
              {job.resultImages.slice(0, 6).map((image, index) => (
                <Avatar
                  key={index}
                  src={image.url}
                  onClick={() => onImageView(job.resultImages, index)}
                  sx={{
                    width: { xs: 40, sm: 56, md: 64 },
                    height: { xs: 40, sm: 56, md: 64 },
                    cursor: 'pointer',
                    flexShrink: 0,
                    '&:hover': { opacity: 0.8, transform: 'scale(1.05)', transition: 'all 0.2s ease' }
                  }}
                  variant="rounded"
                />
              ))}
              {job.resultImages.length > 6 && (
                <Avatar
                  onClick={() => onImageView(job.resultImages, 6)}
                  sx={{
                    width: { xs: 40, sm: 56, md: 64 },
                    height: { xs: 40, sm: 56, md: 64 },
                    bgcolor: 'grey.200', color: 'grey.600',
                    cursor: 'pointer',
                    fontSize: { xs: '0.65rem', sm: '0.75rem' },
                    flexShrink: 0,
                    '&:hover': { bgcolor: 'grey.300' }
                  }}
                  variant="rounded"
                >
                  +{job.resultImages.length - 6}
                </Avatar>
              )}
            </Box>
          </Box>
        )}

        {/* 생성된 동영상들 */}
        {job.resultVideos?.length > 0 && (
          <Box mb={{ xs: 1.5, md: 1 }}>
            <Typography variant="caption" display="block" gutterBottom>
              생성된 동영상 ({job.resultVideos.length}개)
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: '100%', overflow: 'hidden' }}>
              {job.resultVideos.slice(0, 6).map((video, index) => (
                <Box
                  key={video._id || index}
                  onClick={() => onImageView(job.resultVideos, index, true)}
                  sx={{
                    width: { xs: 40, sm: 56, md: 64 },
                    height: { xs: 40, sm: 56, md: 64 },
                    cursor: 'pointer', flexShrink: 0,
                    position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'black',
                    '&:hover': { opacity: 0.8, transform: 'scale(1.05)', transition: 'all 0.2s ease' }
                  }}
                >
                  <video
                    src={video.url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                  />
                  <Box sx={{ position: 'absolute', bottom: 2, right: 2, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 0.5, p: 0.25 }}>
                    <Videocam sx={{ color: 'white', fontSize: 12 }} />
                  </Box>
                </Box>
              ))}
              {job.resultVideos.length > 6 && (
                <Avatar
                  onClick={() => onImageView(job.resultVideos, 6, true)}
                  sx={{
                    width: { xs: 40, sm: 56, md: 64 },
                    height: { xs: 40, sm: 56, md: 64 },
                    bgcolor: 'grey.200', color: 'grey.600',
                    cursor: 'pointer',
                    fontSize: { xs: '0.65rem', sm: '0.75rem' },
                    flexShrink: 0,
                    '&:hover': { bgcolor: 'grey.300' }
                  }}
                  variant="rounded"
                >
                  +{job.resultVideos.length - 6}
                </Avatar>
              )}
            </Box>
          </Box>
        )}

        {/* 에러 메시지 */}
        {job.status === 'failed' && job.error && (
          <Alert severity="error" sx={{ mb: { xs: 1.5, md: 1 }, py: 0.5 }}>
            <Typography variant="caption">{job.error.message}</Typography>
          </Alert>
        )}

        {/* 메타데이터 + 액션 버튼 */}
        <Box
          sx={{
            display: { xs: 'block', md: 'flex' },
            alignItems: { md: 'flex-end' },
            gap: { md: 2 },
          }}
        >
          <Box
            sx={{
              flex: { md: 1 },
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(5, 1fr)'
              },
              gap: 1,
              mb: { xs: 1, md: 0 },
              '& > div': { minWidth: 0, overflow: 'hidden' }
            }}
          >
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">생성 시간</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {new Date(job.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">소요 시간</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatDuration(job.actualTime)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">AI 모델</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeof job.inputData?.aiModel === 'object' && job.inputData.aiModel?.key
                  ? job.inputData.aiModel.key
                  : job.inputData?.aiModel || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">크기</Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeof job.inputData?.imageSize === 'object' && job.inputData.imageSize?.key
                  ? job.inputData.imageSize.key
                  : job.inputData?.imageSize || '-'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="textSecondary" display="block">시드</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {job.inputData?.seed !== undefined
                  ? (job.inputData.seed.toString().length > 8
                    ? `${job.inputData.seed.toString().slice(0, 8)}...`
                    : job.inputData.seed)
                  : '-'}
              </Typography>
            </Box>
          </Box>

          {!readOnly && (
            <Box
              sx={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 0.5, flexShrink: 0,
                '& .MuiButton-root': { fontSize: { xs: '0.75rem', sm: '0.875rem' }, px: { xs: 1, sm: 1.5 }, minWidth: { xs: 'auto', sm: 'auto' } }
              }}
            >
              <Button size="small" onClick={() => onView(job)} startIcon={<Info />}
                sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
              >
                상세
              </Button>

              {canContinue && (
                <>
                  <Button size="small" onClick={() => onContinue(job)} startIcon={<PlayArrow />} color="success" variant="contained"
                    sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>계속하기</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>계속</Box>
                  </Button>
                  <Button size="small" onClick={() => onCrossWorkboard(job)} startIcon={<SwapHoriz />} color="info" variant="outlined"
                    sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>다른 작업</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>다른</Box>
                  </Button>
                  <Button size="small" onClick={() => onSavePrompt(job)} startIcon={<Save />} color="secondary"
                    sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>프롬프트 저장</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>저장</Box>
                  </Button>
                </>
              )}

              {canRetry && (
                <Button size="small" onClick={() => onRetry(job)} startIcon={<Refresh />} color="primary"
                  sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                >
                  재시도
                </Button>
              )}

              {canCancel && (
                <Button size="small" onClick={() => onCancel(job)} startIcon={<Stop />} color="warning"
                  sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                >
                  취소
                </Button>
              )}

              <Button size="small" onClick={() => onDelete(job)} startIcon={<Delete />} color="error"
                sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
              >
                삭제
              </Button>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function JobDetailDialog({ job, open, onClose, onImageView }) {
  if (!job) return null;

  // 태그 표시
  const tags = job.inputData?.tags || [];
  const populatedTags = tags.filter(t => typeof t === 'object' && t.name);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">작업 상세 정보</Typography>
          <IconButton onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>프롬프트</Typography>
          <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
            {job.inputData?.prompt || '프롬프트 없음'}
          </Typography>
        </Box>

        {job.inputData?.negativePrompt && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>부정 프롬프트</Typography>
            <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
              {job.inputData.negativePrompt}
            </Typography>
          </Box>
        )}

        {populatedTags.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>태그</Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap">
              {populatedTags.map((tag) => (
                <ProjectTagChip key={tag._id} tag={tag} />
              ))}
            </Box>
          </Box>
        )}

        <Grid container spacing={2} mb={3}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">상태</Typography>
            <JobStatusChip status={job.status} />
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">작업판</Typography>
            <Typography variant="body1">{job.workboardId?.name || '알 수 없음'}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">AI 모델</Typography>
            <Typography variant="body1">
              {typeof job.inputData?.aiModel === 'object' && job.inputData.aiModel?.key
                ? job.inputData.aiModel.key
                : job.inputData?.aiModel || '-'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">요청 크기</Typography>
            <Typography variant="body1">
              {typeof job.inputData?.imageSize === 'object' && job.inputData.imageSize?.key
                ? job.inputData.imageSize.key
                : job.inputData?.imageSize || '-'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">시드 (Seed)</Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
              {job.inputData?.seed !== undefined ? job.inputData.seed : '-'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">실제 이미지 크기</Typography>
            <Typography variant="body1">
              {job.resultImages?.length > 0 && job.resultImages[0].metadata?.width && job.resultImages[0].metadata?.height
                ? `${job.resultImages[0].metadata.width} x ${job.resultImages[0].metadata.height}`
                : '정보 없음'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">생성 시간</Typography>
            <Typography variant="body1">{new Date(job.createdAt).toLocaleString()}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">완료 시간</Typography>
            <Typography variant="body1">
              {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
            </Typography>
          </Grid>
        </Grid>

        {job.inputData?.referenceImages?.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>참고 이미지</Typography>
            <Grid container spacing={2}>
              {job.inputData.referenceImages.map((ref, index) => (
                <Grid item xs={6} sm={4} md={3} key={index}>
                  <Box>
                    <img src={ref.image?.url} alt="Reference"
                      style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <Typography variant="caption" display="block" textAlign="center" mt={1}>{ref.method}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {job.resultImages?.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>생성된 이미지</Typography>
            <Grid container spacing={2}>
              {job.resultImages.map((image, index) => (
                <Grid item xs={6} sm={4} md={3} key={index}>
                  <Box
                    onClick={() => onImageView(job.resultImages, index)}
                    sx={{
                      cursor: 'pointer', borderRadius: '8px', overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }
                    }}
                  >
                    <img src={image.url} alt="Generated"
                      style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {job.resultVideos?.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>생성된 동영상</Typography>
            <Grid container spacing={2}>
              {job.resultVideos.map((video, index) => (
                <Grid item xs={6} sm={4} md={3} key={video._id || index}>
                  <Box
                    onClick={() => onImageView(job.resultVideos, index, true)}
                    sx={{
                      cursor: 'pointer', borderRadius: '8px', overflow: 'hidden',
                      transition: 'all 0.2s ease', position: 'relative', bgcolor: 'black',
                      '&:hover': { transform: 'scale(1.02)', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }
                    }}
                  >
                    <video src={video.url} style={{ width: '100%', height: '120px', objectFit: 'cover' }} muted />
                    <Box sx={{ position: 'absolute', bottom: 4, right: 4, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 0.5, p: 0.5 }}>
                      <Videocam sx={{ color: 'white', fontSize: 16 }} />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {job.status === 'failed' && job.error && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom color="error">에러 정보</Typography>
            <Alert severity="error">
              <Typography variant="body2"><strong>메시지:</strong> {job.error.message}</Typography>
              {job.error.code && (
                <Typography variant="body2" mt={1}><strong>코드:</strong> {job.error.code}</Typography>
              )}
            </Alert>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function JobHistoryPanel({
  fetchFn,
  queryKey,
  readOnly = false,
  showSearch = true,
  showStatusFilter = true,
  showTags = true,
  pageSize = 10,
  autoRefetch = true,
  responseExtractor
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [videoViewerOpen, setVideoViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerVideos, setViewerVideos] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [savingJob, setSavingJob] = useState(null);
  const [crossWorkboardOpen, setCrossWorkboardOpen] = useState(false);
  const [crossWorkboardJob, setCrossWorkboardJob] = useState(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    [queryKey, { search, status: statusFilter, page, limit: pageSize }],
    () => fetchFn({ search: search || undefined, status: statusFilter || undefined, page, limit: pageSize }),
    {
      refetchInterval: autoRefetch ? config.monitoring.recentJobsInterval : false,
      keepPreviousData: true
    }
  );

  const defaultExtractor = (data) => {
    // Handle both job route format ({ jobs, pagination }) and project route format ({ data: { jobs, pagination } })
    const d = data?.data?.data || data?.data || {};
    return {
      jobs: d.jobs || [],
      pagination: d.pagination || {}
    };
  };

  const extractor = responseExtractor || defaultExtractor;
  const { jobs, pagination } = extractor(data);

  // 사용자 설정 가져오기
  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};

  const retryMutation = useMutation(jobAPI.retry, {
    onSuccess: () => { toast.success('작업을 재시도합니다'); queryClient.invalidateQueries(queryKey); },
    onError: (error) => { toast.error('재시도 실패: ' + error.message); }
  });

  const cancelMutation = useMutation(jobAPI.cancel, {
    onSuccess: () => { toast.success('작업이 취소되었습니다'); queryClient.invalidateQueries(queryKey); },
    onError: (error) => { toast.error('취소 실패: ' + error.message); }
  });

  const deleteMutation = useMutation(
    ({ id, deleteContent }) => jobAPI.delete(id, deleteContent),
    {
      onSuccess: (response) => {
        const { deletedImagesCount, deletedVideosCount } = response.data;
        if (deletedImagesCount > 0 || deletedVideosCount > 0) {
          toast.success(`작업과 ${deletedImagesCount}개 이미지, ${deletedVideosCount}개 동영상이 삭제되었습니다`);
          queryClient.invalidateQueries('generatedImages');
          queryClient.invalidateQueries('videos');
        } else {
          toast.success('작업이 삭제되었습니다');
        }
        queryClient.invalidateQueries(queryKey);
      },
      onError: (error) => { toast.error('삭제 실패: ' + error.message); }
    }
  );

  const savePromptMutation = useMutation(promptDataAPI.create, {
    onSuccess: () => { toast.success('프롬프트 데이터가 저장되었습니다'); setSavePromptOpen(false); setSavingJob(null); },
    onError: (error) => { toast.error('프롬프트 저장 실패: ' + (error.response?.data?.message || error.message)); }
  });

  const handleView = (job) => { setSelectedJob(job); setDetailOpen(true); };
  const handleRetry = (job) => { if (window.confirm('작업을 재시도하시겠습니까?')) retryMutation.mutate(job._id); };
  const handleCancel = (job) => { if (window.confirm('작업을 취소하시겠습니까?')) cancelMutation.mutate(job._id); };

  const handleDelete = (job) => {
    const hasContent = (job.resultImages?.length > 0) || (job.resultVideos?.length > 0);
    const deleteContentSetting = userPreferences.deleteContentWithHistory;

    if (deleteContentSetting && hasContent) {
      const contentCount = (job.resultImages?.length || 0) + (job.resultVideos?.length || 0);
      if (window.confirm(`작업과 연관된 ${contentCount}개의 컨텐츠(이미지/동영상)도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        deleteMutation.mutate({ id: job._id, deleteContent: true });
      }
    } else {
      if (window.confirm('작업 히스토리를 삭제하시겠습니까?\n\n생성된 이미지/동영상은 보존됩니다.')) {
        deleteMutation.mutate({ id: job._id, deleteContent: false });
      }
    }
  };

  const handleImageView = (items, index = 0, isVideo = false) => {
    if (isVideo) {
      setViewerVideos(items);
      setSelectedVideoIndex(index);
      setVideoViewerOpen(true);
    } else {
      setViewerImages(items);
      setSelectedImageIndex(index);
      setImageViewerOpen(true);
    }
  };

  const handleContinueJob = async (job) => {
    try {
      let workboardId = null;
      if (typeof job.workboardId === 'string') workboardId = job.workboardId;
      else if (job.workboardId?._id) workboardId = job.workboardId._id;
      else if (job.workboardId?.id) workboardId = job.workboardId.id;

      if (!workboardId || workboardId === 'undefined' || workboardId === 'null') {
        toast.error('작업판 정보를 찾을 수 없습니다. 작업판 선택 페이지로 이동합니다.');
        localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
        navigate('/workboards');
        return;
      }

      if (!/^[0-9a-fA-F]{24}$/.test(workboardId)) {
        toast.error('잘못된 작업판 ID입니다. 작업판 선택 페이지로 이동합니다.');
        localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
        navigate('/workboards');
        return;
      }

      const workboardResponse = await workboardAPI.getById(workboardId);
      const workboard = workboardResponse.data?.workboard;

      if (!workboard) {
        toast.error('작업판을 찾을 수 없습니다. 작업판 선택 페이지로 이동합니다.');
        localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
        navigate('/workboards');
        return;
      }

      if (!workboard.isActive) {
        toast.error('작업판이 비활성화되었습니다. 작업판 선택 페이지로 이동합니다.');
        localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
        navigate('/workboards');
        return;
      }

      localStorage.setItem('continueJobData', JSON.stringify({
        workboardId,
        inputData: job.inputData,
        workboard
      }));
      navigate(`/generate/${workboardId}`);
      toast.success('작업 설정을 불러왔습니다');
    } catch (error) {
      console.error('Continue job error:', error);
      if (error.response?.status === 404) toast.error('작업판이 존재하지 않습니다. 작업판 선택 페이지로 이동합니다.');
      else if (error.response?.status === 403) toast.error('작업판 접근 권한이 없습니다. 작업판 선택 페이지로 이동합니다.');
      else toast.error('작업을 계속할 수 없습니다. 작업판 선택 페이지로 이동합니다.');

      localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
      navigate('/workboards');
    }
  };

  const handleSavePrompt = (job) => { setSavingJob(job); setSavePromptOpen(true); };
  const handleSavePromptSubmit = (data) => { savePromptMutation.mutate(data); };

  const handleCrossWorkboard = (job) => {
    setCrossWorkboardJob(job);
    setCrossWorkboardOpen(true);
  };

  const handleWorkboardSelected = (workboard) => {
    if (!crossWorkboardJob) return;

    const job = crossWorkboardJob;

    // 마지막 생성 미디어 추출
    const lastGeneratedImage = job.resultImages?.length > 0
      ? job.resultImages[job.resultImages.length - 1]
      : null;
    const lastGeneratedVideo = job.resultVideos?.length > 0
      ? job.resultVideos[job.resultVideos.length - 1]
      : null;

    localStorage.setItem('continueJobData', JSON.stringify({
      workboardId: workboard._id,
      inputData: job.inputData,
      workboard: workboard,
      lastGeneratedMedia: {
        image: lastGeneratedImage,
        video: lastGeneratedVideo
      }
    }));

    setCrossWorkboardOpen(false);
    setCrossWorkboardJob(null);
    navigate(`/generate/${workboard._id}`);
    toast.success('작업판이 선택되었습니다. 설정을 매칭합니다.');
  };

  return (
    <>
      {(showSearch || showStatusFilter) && (
        <Grid container spacing={2} mb={3}>
          {showSearch && (
            <Grid item xs={12} sm={showStatusFilter ? 6 : 12}>
              <TextField
                fullWidth
                placeholder="프롬프트로 검색..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><Search /></InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}
          {showStatusFilter && (
            <Grid item xs={12} sm={showSearch ? 6 : 12}>
              <FormControl fullWidth>
                <InputLabel>상태</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  label="상태"
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="pending">대기중</MenuItem>
                  <MenuItem value="processing">처리중</MenuItem>
                  <MenuItem value="completed">완료</MenuItem>
                  <MenuItem value="failed">실패</MenuItem>
                  <MenuItem value="cancelled">취소됨</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      ) : jobs.length === 0 ? (
        <Alert severity="info">
          {search || statusFilter ? '검색 결과가 없습니다.' : '작업 히스토리가 없습니다.'}
        </Alert>
      ) : (
        <>
          {jobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onView={handleView}
              onRetry={handleRetry}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onImageView={handleImageView}
              onContinue={handleContinueJob}
              onCrossWorkboard={handleCrossWorkboard}
              onSavePrompt={handleSavePrompt}
              readOnly={readOnly}
              showTags={showTags}
            />
          ))}

          <Box mt={4}>
            <Pagination
              currentPage={page}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              onPageChange={setPage}
              showInfo={true}
              showFirstLast={true}
              showGoToPage={true}
              maxVisible={3}
            />
          </Box>
        </>
      )}

      <JobDetailDialog
        job={selectedJob}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onImageView={handleImageView}
      />

      <ImageViewerDialog
        images={viewerImages}
        selectedIndex={selectedImageIndex}
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="생성된 이미지"
      />

      <VideoViewerDialog
        videos={viewerVideos}
        selectedIndex={selectedVideoIndex}
        open={videoViewerOpen}
        onClose={() => setVideoViewerOpen(false)}
        title="생성된 동영상"
      />

      <SavePromptDialog
        open={savePromptOpen}
        onClose={() => { setSavePromptOpen(false); setSavingJob(null); }}
        job={savingJob}
        onSave={handleSavePromptSubmit}
      />

      <WorkboardSelectDialog
        open={crossWorkboardOpen}
        onClose={() => { setCrossWorkboardOpen(false); setCrossWorkboardJob(null); }}
        onSelect={handleWorkboardSelected}
      />
    </>
  );
}

export default JobHistoryPanel;
