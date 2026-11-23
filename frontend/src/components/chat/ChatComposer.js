import React, { useRef, useState } from 'react';
import { Box, TextField, IconButton, Tooltip, CircularProgress, Typography } from '@mui/material';
import { Send, AddPhotoAlternateOutlined, PhotoLibraryOutlined, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { imageAPI } from '../../services/api';
import ImageSelectDialog from '../common/ImageSelectDialog';

// 서버 상한과 같다 (src/utils/visionImages MAX_IMAGES). 넘겨 보내면 서버가 400 으로 알려 준다
export const MAX_CHAT_ATTACHMENTS = 4;

/** 이미 붙인 것은 건너뛰고 상한까지만 더한다 */
export function addAttachments(current, incoming, max = MAX_CHAT_ATTACHMENTS) {
  const next = [...current];
  for (const item of incoming) {
    if (!item?.imageId || next.some((a) => String(a.imageId) === String(item.imageId))) continue;
    if (next.length >= max) break;
    next.push({ imageId: item.imageId, url: item.url });
  }
  return next;
}

// 채팅 입력 (#1288) — 글, 이미지 첨부(새로 올리기 · 내 이미지에서 고르기).
// 첨부는 대화 상대가 이미지를 볼 수 있는지와 무관하게 받는다 — 붙인 이미지는 생성 작업의 입력으로 쓰인다.
// onAttachmentsChange 는 setState 처럼 (지금 목록) => 새 목록 함수를 받는다.
export default function ChatComposer({ text, onTextChange, attachments, onAttachmentsChange, onSend, disabled, placeholder, visionNote }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const full = attachments.length >= MAX_CHAT_ATTACHMENTS;
  const canSend = !disabled && !uploading && text.trim().length > 0;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_CHAT_ATTACHMENTS - attachments.length);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    const uploaded = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('imageType', 'reference');
        const resp = await imageAPI.upload(fd);
        uploaded.push({ imageId: resp.data.image._id, url: resp.data.image.url });
      }
    } catch (err) {
      toast.error(`이미지를 올리지 못했습니다: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
      // 올리는 동안 첨부를 뺐을 수 있다 — 그때의 목록이 아니라 지금 목록에 더한다
      if (uploaded.length > 0) onAttachmentsChange((cur) => addAttachments(cur, uploaded));
    }
  };

  const handleKeyDown = (e) => {
    // 한글 조합 중의 Enter 는 글자 확정이다 — 보내지 않는다
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', p: 3, bgcolor: 'background.paper' }}>
      {attachments.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
          {attachments.map((a) => (
            <Box key={a.imageId} sx={{ position: 'relative', width: 56, height: 56 }}>
              <Box component="img" src={a.url} alt="붙인 이미지"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, border: 1, borderColor: 'divider' }} />
              <IconButton
                size="small" aria-label="첨부 빼기"
                onClick={() => onAttachmentsChange((cur) => cur.filter((x) => x.imageId !== a.imageId))}
                sx={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, bgcolor: 'background.paper', border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.paper' } }}
              >
                <Close sx={{ fontSize: 12 }} />
              </IconButton>
            </Box>
          ))}
          {visionNote && (
            <Typography variant="caption" sx={{ color: 'text.tertiary' }}>{visionNote}</Typography>
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
        <Tooltip title={full ? `이미지는 ${MAX_CHAT_ATTACHMENTS}장까지 붙일 수 있습니다` : '이미지 올려서 붙이기'}>
          <span>
            <IconButton aria-label="이미지 올려서 붙이기" disabled={disabled || uploading || full} onClick={() => fileRef.current?.click()}>
              {uploading ? <CircularProgress size={20} /> : <AddPhotoAlternateOutlined />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="내 이미지에서 고르기">
          <span>
            <IconButton aria-label="내 이미지에서 고르기" disabled={disabled || uploading || full} onClick={() => setPickerOpen(true)}>
              <PhotoLibraryOutlined />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          fullWidth multiline maxRows={8} size="small"
          placeholder={placeholder}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          inputProps={{ 'aria-label': '메시지', maxLength: 20000 }}
        />
        <Tooltip title="보내기 (Enter)">
          <span>
            <IconButton color="primary" aria-label="보내기" disabled={!canSend} onClick={onSend}>
              <Send />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <ImageSelectDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="붙일 이미지 고르기"
        multiple
        maxImages={MAX_CHAT_ATTACHMENTS - attachments.length}
        onSelect={(selected) => onAttachmentsChange((cur) => addAttachments(
          cur,
          selected.map((s) => ({ imageId: s.imageId, url: s.image?.url })),
        ))}
      />
    </Box>
  );
}
