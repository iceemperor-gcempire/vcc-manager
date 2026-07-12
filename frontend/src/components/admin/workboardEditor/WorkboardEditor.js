// 작업판 편집기 본체 — 3-pane (#713 R3, 승인 시안 구현).
// 좌 = 설정 레일(기본 정보·권한/노출·워크플로우 요약·LLM 파라미터), 중앙 = 입력 양식 빌더,
// 우 = 필드 인스펙터 ↔ 라이브 프리뷰. 구 탭 4개 구조(#437 Phase A) 폐기.
//
// 가드 3종 (#440 감사):
// - dirty 이탈 경고: 미저장 변경 시 취소/뒤로 확인 + beforeunload
// - 서버 전환 시 workflowData 소실 경고 (감사 6-A): ComfyUI → 비ComfyUI 확인 모달
// - 미완성 필드 저장 차단 (감사 6-C): 이름/표시명 빈 필드는 무경고 폐기 대신 저장 차단 + 포커스
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Check, ContentCopy } from '@mui/icons-material';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workboardAPI, serverAPI, groupAPI } from '../../../services/api';
import { copyToClipboard } from '../../../utils/clipboard';
import { MONO } from '../../../theme';
import { emptyCustomField } from './shared';
import SettingsRail from './SettingsRail';
import FieldBuilder from './FieldBuilder';
import FieldInspector from './FieldInspector';
import WorkflowEditDialog from './WorkflowEditDialog';

export function WorkboardEditor({ workboard, onSave, onCancel }) {
  const [selectedFieldIdx, setSelectedFieldIdx] = useState(-1);
  const [rightTab, setRightTab] = useState('preview');
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [serverSwitchConfirm, setServerSwitchConfirm] = useState(null); // { prev: {serverId, serverType} }
  const [loading, setLoading] = useState(false);
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [copiedId, setCopiedId] = useState(false);
  const copyTimerRef = useRef(null);
  // 서버 전환 가드 기준점 — hydration 직후의 (또는 마지막으로 승인된) 서버
  const safeServerRef = useRef({ serverId: '', serverType: '' });

  const { control, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      serverId: '',
      serverType: '',
      outputFormat: 'image',
      workflowData: '',
      allowedModelTypes: [],
      allowedGroupIds: [],
      modelExposurePolicy: 'full',
      modelWhitelist: [],
      loraExposurePolicy: 'full',
      loraWhitelist: [],
      llmExtraParams: '',
      isActive: true,
      additionalCustomFields: [],
    },
  });

  // rule(react-form-dnd-reorder) 준수 — useFieldArray + 안정 id (fieldKey)
  const { fields: customFields, append, remove, move } = useFieldArray({
    control,
    name: 'additionalCustomFields',
    keyName: 'fieldKey',
  });
  // fields 는 append 시점 스냅샷이라 최신 입력값은 watch 와 병합해 표시
  const watchedFields = watch('additionalCustomFields') || [];
  const displayFields = customFields.map((f, i) => ({ ...f, ...(watchedFields[i] || {}) }));

  const serverType = watch('serverType');
  const outputFormat = watch('outputFormat');
  const watchedServerId = watch('serverId');
  const isComfyUI = serverType === 'ComfyUI';
  const isGemini = serverType === 'Gemini';
  const isOpenAIImage = (serverType === 'OpenAI' || serverType === 'OpenAI Compatible') && outputFormat === 'image';

  // ComfyUI 서버의 availableBaseModels (#252) — allowedModelTypes 옵션 풀
  useEffect(() => {
    if (!isComfyUI || !watchedServerId) {
      setAvailableBaseModels([]);
      return;
    }
    serverAPI.getDetailedModels(watchedServerId, { limit: 1 })
      .then((res) => setAvailableBaseModels(res.data?.data?.availableBaseModels || []))
      .catch(() => setAvailableBaseModels([]));
  }, [isComfyUI, watchedServerId]);

  // 그룹 목록 (#198) — 실패 시 재시도 없이 빈 목록이면 칩이 raw id 로 보이므로 에러 안내
  useEffect(() => {
    groupAPI.getAll()
      .then((res) => setAvailableGroups(res.data?.data?.groups || []))
      .catch(() => {
        setAvailableGroups([]);
        toast.error('그룹 목록을 불러오지 못했습니다 — 접근 그룹이 ID 로 표시될 수 있습니다.');
      });
  }, []);

  // 관리자 전용 API 로 완전한 데이터 로딩 + 폼 hydration
  useEffect(() => {
    if (!(workboard && workboard._id)) return;
    setLoading(true);
    workboardAPI.getByIdAdmin(workboard._id)
      .then((response) => {
        const fullData = response.data.workboard;
        const hydratedServerId = fullData.serverId?._id || fullData.serverId || '';
        const hydratedServerType = fullData.serverId?.serverType || '';
        reset({
          name: fullData.name || '',
          description: fullData.description || '',
          serverId: hydratedServerId,
          serverType: hydratedServerType,
          outputFormat: fullData.outputFormat || (fullData.workboardType === 'prompt' ? 'text' : 'image'),
          workflowData: fullData.workflowData || '',
          allowedModelTypes: fullData.allowedModelTypes || [],
          allowedGroupIds: (fullData.allowedGroupIds || []).map((g) => (typeof g === 'object' ? g._id : g)),
          modelExposurePolicy: fullData.modelExposurePolicy || 'full',
          modelWhitelist: fullData.modelWhitelist || [],
          loraExposurePolicy: fullData.loraExposurePolicy || 'full',
          loraWhitelist: fullData.loraWhitelist || [],
          llmExtraParams: fullData.llmExtraParams && Object.keys(fullData.llmExtraParams).length > 0
            ? JSON.stringify(fullData.llmExtraParams, null, 2)
            : '',
          isActive: fullData.isActive ?? true,
          additionalCustomFields: (fullData.additionalInputFields || []).map((f) => ({
            ...f,
            defaultValue: f.defaultValue,
            description: f.description || '',
            placeholder: f.placeholder || '',
            imageConfig: f.imageConfig || { maxImages: 1 },
          })),
        });
        safeServerRef.current = { serverId: hydratedServerId, serverType: hydratedServerType };
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching full workboard data:', error);
        setLoading(false);
      });
  }, [workboard?._id, reset]);

  // 서버 전환 가드 (감사 6-A) — ComfyUI → 비ComfyUI 전환은 저장 시 workflowData 가
  // 소실되므로, 작성된 JSON 이 있으면 확인 모달을 거친다.
  useEffect(() => {
    const prev = safeServerRef.current;
    if (!serverType || serverType === prev.serverType) return;
    const losesWorkflow = prev.serverType === 'ComfyUI' && serverType !== 'ComfyUI' && (watch('workflowData') || '').trim();
    if (losesWorkflow) {
      setServerSwitchConfirm({ prev: { ...prev } });
    } else {
      safeServerRef.current = { serverId: watchedServerId, serverType };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverType, watchedServerId]);

  // dirty 이탈 경고 — 브라우저 이탈(새로고침/탭 닫기)
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const handleCancel = () => {
    if (isDirty) {
      setLeaveConfirmOpen(true);
    } else {
      onCancel();
    }
  };

  const handleCopyId = async () => {
    try {
      await copyToClipboard(workboard?._id);
      setCopiedId(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(false), 1500);
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const onSubmit = (data) => {
    // 미완성 필드 저장 차단 (감사 6-C) — 기존엔 무경고 폐기됐음
    const incompleteIdx = (data.additionalCustomFields || []).findIndex((f) => !f.name || !f.label);
    if (incompleteIdx !== -1) {
      toast.error(`필드명/표시명이 비어 있는 필드가 있습니다 (${incompleteIdx + 1}번째). 채우거나 삭제 후 저장하세요.`);
      setSelectedFieldIdx(incompleteIdx);
      setRightTab('inspector');
      return;
    }

    const additionalInputFields = (data.additionalCustomFields || []).map((field) => {
      const fieldData = {
        name: field.name,
        label: field.label,
        type: field.type || 'string',
        required: Boolean(field.required),
        formatString: field.formatString || `{{##${field.name}##}}`,
      };
      // defaultValue / description / placeholder 보존 (#391). boolean 은 false 도 의미 있음.
      if (field.defaultValue !== undefined && field.defaultValue !== '') {
        if (field.type === 'number') {
          const n = Number(field.defaultValue);
          if (!Number.isNaN(n)) fieldData.defaultValue = n;
        } else if (field.type === 'boolean') {
          fieldData.defaultValue = Boolean(field.defaultValue);
        } else {
          fieldData.defaultValue = field.defaultValue;
        }
      } else if (field.type === 'boolean' && field.defaultValue === false) {
        fieldData.defaultValue = false;
      }
      if (field.description) fieldData.description = field.description;
      if (field.placeholder) fieldData.placeholder = field.placeholder;
      if (field.type === 'select') fieldData.options = field.options || [];
      if (field.type === 'image') {
        fieldData.imageConfig = { maxImages: field.imageConfig?.maxImages || 1 };
      }
      return fieldData;
    });

    // LLM 추가 파라미터 (#493) — JSON 문자열을 파싱해 객체로. 비었으면 빈 객체.
    let parsedLlmExtraParams = {};
    const rawExtra = (data.llmExtraParams || '').trim();
    if (rawExtra) {
      try {
        parsedLlmExtraParams = JSON.parse(rawExtra);
        if (typeof parsedLlmExtraParams !== 'object' || Array.isArray(parsedLlmExtraParams)) {
          throw new Error('객체(JSON object) 형태여야 합니다');
        }
      } catch (e) {
        toast.error('추가 LLM 파라미터 JSON 형식 오류: ' + e.message);
        return;
      }
    }

    const isComfyUIServer = data.serverType === 'ComfyUI';
    onSave({
      name: data.name?.trim(),
      description: data.description?.trim(),
      serverId: data.serverId,
      outputFormat: data.outputFormat || 'image',
      workflowData: isComfyUIServer ? data.workflowData : '',
      allowedModelTypes: isComfyUIServer ? (data.allowedModelTypes || []) : [],
      allowedGroupIds: data.allowedGroupIds || [],
      modelExposurePolicy: data.modelExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      modelWhitelist: Array.isArray(data.modelWhitelist) ? data.modelWhitelist : [],
      loraExposurePolicy: isComfyUIServer && data.loraExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      loraWhitelist: isComfyUIServer && Array.isArray(data.loraWhitelist) ? data.loraWhitelist : [],
      llmExtraParams: parsedLlmExtraParams,
      isActive: Boolean(data.isActive),
      additionalInputFields,
    });
  };

  return (
    <>
      {/* sticky 헤더 */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
        py: 2, mb: 4,
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      }}>
        <Button onClick={handleCancel} sx={{ flexShrink: 0 }}>← 작업판 관리</Button>
        <Typography variant="h6" sx={{ fontWeight: 800, wordBreak: 'break-word' }}>
          {workboard?.name || '작업판 편집'}
        </Typography>
        <Chip
          label={watch('isActive') ? '활성' : '비활성'}
          color={watch('isActive') ? 'success' : 'default'}
          variant="outlined"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            {workboard?._id}
          </Typography>
          <IconButton size="small" onClick={handleCopyId} disabled={!workboard?._id} aria-label="작업판 ID 복사">
            {copiedId ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
          </IconButton>
        </Box>
        <Box sx={{ flex: 1 }} />
        {isDirty && (
          <Typography variant="caption" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />
            저장되지 않은 변경
          </Typography>
        )}
        <Button onClick={handleCancel}>취소</Button>
        <Button form="wbEditForm" type="submit" variant="contained" disabled={loading}>저장</Button>
      </Box>

      <form id="wbEditForm" onSubmit={handleSubmit(onSubmit)}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>작업판 데이터 로딩 중...</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px 1fr 340px' }, gap: 4, alignItems: 'start' }}>
            <SettingsRail
              control={control}
              setValue={setValue}
              errors={errors}
              watch={watch}
              isComfyUI={isComfyUI}
              isGemini={isGemini}
              isOpenAIImage={isOpenAIImage}
              outputFormat={outputFormat}
              serverId={watchedServerId}
              groups={availableGroups}
              onOpenWorkflowEditor={() => setWorkflowDialogOpen(true)}
            />

            <FieldBuilder
              fields={displayFields}
              selectedIdx={selectedFieldIdx}
              onSelect={(idx) => {
                setSelectedFieldIdx(idx);
                setRightTab('inspector');
              }}
              onAdd={(type) => {
                append(emptyCustomField(type));
                setSelectedFieldIdx(customFields.length);
                setRightTab('inspector');
              }}
              onMove={(from, to) => {
                move(from, to);
                if (selectedFieldIdx === from) setSelectedFieldIdx(to);
                else if (from < selectedFieldIdx && to >= selectedFieldIdx) setSelectedFieldIdx(selectedFieldIdx - 1);
                else if (from > selectedFieldIdx && to <= selectedFieldIdx) setSelectedFieldIdx(selectedFieldIdx + 1);
              }}
            />

            <FieldInspector
              control={control}
              watch={watch}
              selectedIdx={selectedFieldIdx}
              rightTab={rightTab}
              onRightTabChange={setRightTab}
              serverId={watchedServerId}
              onRemoveSelected={() => {
                remove(selectedFieldIdx);
                setSelectedFieldIdx(-1);
                setRightTab('preview');
              }}
            />
          </Box>
        )}
      </form>

      {/* 워크플로우 편집 (풀스크린) — 같은 form control 공유 */}
      {isComfyUI && (
        <WorkflowEditDialog
          open={workflowDialogOpen}
          onClose={() => setWorkflowDialogOpen(false)}
          control={control}
          watch={watch}
          setValue={setValue}
          errors={errors}
          availableBaseModels={availableBaseModels}
        />
      )}

      {/* dirty 이탈 확인 */}
      <Dialog open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>저장하지 않고 나갈까요?</DialogTitle>
        <DialogContent>
          <DialogContentText>저장되지 않은 변경사항이 있습니다. 나가면 사라집니다.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveConfirmOpen(false)}>계속 편집</Button>
          <Button color="error" variant="contained" onClick={onCancel}>나가기</Button>
        </DialogActions>
      </Dialog>

      {/* 서버 전환 → workflowData 소실 확인 (감사 6-A) */}
      <Dialog open={!!serverSwitchConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>워크플로우가 삭제됩니다</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ComfyUI 가 아닌 서버로 전환하면 저장 시 작성된 워크플로우 JSON 과 모델 타입/LoRA 정책이
            함께 삭제됩니다. 계속할까요?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              const prev = serverSwitchConfirm.prev;
              setValue('serverId', prev.serverId);
              setValue('serverType', prev.serverType);
              setServerSwitchConfirm(null);
            }}
          >
            전환 취소
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              safeServerRef.current = { serverId: watchedServerId, serverType };
              setServerSwitchConfirm(null);
            }}
          >
            전환하고 삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default WorkboardEditor;
