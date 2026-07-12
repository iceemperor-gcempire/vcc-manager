// 입력 양식 빌더 — 3-pane 중앙 (#713 R3).
// 컴팩트 필드 행 리스트 (dnd) + "+ 필드 추가" 타입 메뉴. 필드 상세는 우측 인스펙터가 담당.
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import { Add, DragIndicator } from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FIELD_TYPES } from './shared';
import { MONO } from '../../../theme';

function FieldBuilder({ fields, selectedIdx, onSelect, onAdd, onMove }) {
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    onMove(result.source.index, result.destination.index);
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
        <Typography variant="h6">입력 양식</Typography>
        <Typography variant="caption" color="text.secondary">
          {fields.length}개 필드 · 드래그로 순서 변경 · 클릭하면 우측에서 편집
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" size="small" startIcon={<Add />} onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
          필드 추가
        </Button>
        <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={() => setAddMenuAnchor(null)}>
          {FIELD_TYPES.map((ft) => (
            <MenuItem
              key={ft.type}
              onClick={() => {
                setAddMenuAnchor(null);
                onAdd(ft.type);
              }}
            >
              <ListItemText primary={ft.label} secondary={ft.hint} />
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="additionalCustomFields">
          {(droppableProvided) => (
            <Box ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
              {fields.map((field, index) => {
                const selected = selectedIdx === index;
                const incomplete = !field.name || !field.label;
                return (
                  // draggableId 는 useFieldArray 의 안정 id (rule: index 사용 금지)
                  <Draggable key={field.fieldKey} draggableId={field.fieldKey} index={index}>
                    {(draggableProvided) => (
                      <Box
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        onClick={() => onSelect(index)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 3,
                          py: 2.5,
                          mb: 2,
                          bgcolor: 'background.paper',
                          border: selected ? 2 : 1,
                          borderColor: selected ? 'primary.main' : (incomplete ? 'warning.main' : 'divider'),
                          borderRadius: 2.5,
                          cursor: 'pointer',
                          boxShadow: selected ? '0 2px 8px rgba(201,106,59,0.10)' : 'none',
                          transition: 'border-color 120ms, box-shadow 120ms',
                          '&:hover': { borderColor: selected ? 'primary.main' : 'grey.400' },
                        }}
                      >
                        <Box
                          {...draggableProvided.dragHandleProps}
                          onClick={(e) => e.stopPropagation()}
                          sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.tertiary' }}
                        >
                          <DragIndicator fontSize="small" />
                        </Box>
                        <Chip
                          label={field.type}
                          variant="outlined"
                          sx={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: selected ? 700 : 500 }} noWrap>
                            {field.label || `새 ${FIELD_TYPES.find((t) => t.type === field.type)?.label || ''} 필드`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }} noWrap>
                            {field.name || '필드명 미입력'}
                          </Typography>
                        </Box>
                        {incomplete && <Chip label="미완성" color="warning" variant="outlined" />}
                        {field.required && <Chip label="required" color="error" variant="outlined" />}
                        {selected && (
                          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, flexShrink: 0 }}>
                            편집 중 →
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>

      <Box
        sx={{
          border: '1.5px dashed',
          borderColor: 'grey.400',
          borderRadius: 2.5,
          p: 3.5,
          textAlign: 'center',
          mt: fields.length === 0 ? 0 : 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {fields.length === 0
            ? '"필드 추가" 로 사용자 입력 항목을 정의하세요. 타입별로 사용자에게 다른 입력 UI 가 제공됩니다.'
            : '"필드 추가" 로 새 입력을 만들거나, 행을 드래그해 순서를 바꾸세요.'}
        </Typography>
      </Box>
    </Box>
  );
}

export default FieldBuilder;
