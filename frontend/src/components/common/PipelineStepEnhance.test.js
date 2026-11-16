/**
 * 파이프라인 단계 카드 — AI 프롬프트 늘려 쓰기 (#1212)
 *
 * 카드를 펼치면 이미지·영상 단계에만 늘려 쓰기 설정이 나오고, 켜면 텍스트 판·지침·문서 안내가 보인다.
 * 알파에서 카드를 펼칠 때 화면이 죽은 일(지역 변수가 helper 이름을 가림)이 있어 렌더 자체를 고정한다.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../../services/api', () => {
  const textBoard = { _id: 't1', name: '프롬프트 LLM', outputFormat: 'text', additionalInputFields: [{ name: 'system_prompt', label: '시스템 프롬프트', type: 'string' }] };
  return {
    workboardAPI: {
      getAll: vi.fn(async () => ({ data: { workboards: [textBoard] } })),
      getById: vi.fn(async (id) => ({ data: { workboard: id === 't1' ? textBoard : { _id: id, promptGeneratorInstructions: 'H3 세 필드로 쓴다' } } })),
    },
    pipelineAPI: {}, pipelineRunAPI: {}, projectAPI: {}, jobAPI: {}, tagAPI: {}, textAPI: {}, promptDataAPI: {},
  };
});

import { StepLaneCard } from './PipelinePanel';

const renderCard = (step, props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StepLaneCard
        step={step}
        index={1}
        isLast
        isMobile={false}
        isSelected
        onSelect={() => {}}
        onOpenInputs={() => {}}
        onOpenDocs={() => {}}
        onMovePrev={() => {}}
        onMoveNext={() => {}}
        onDelete={() => {}}
        onChangeNote={() => {}}
        onChangeInputs={() => {}}
        onToggleAutoInject={() => {}}
        onChangePromptEnhance={() => {}}
        {...props}
      />
    </QueryClientProvider>,
  );
};

const videoBoard = { _id: 'v1', name: 'H3 I2V', outputFormat: 'video', additionalInputFields: [{ name: 'first_frame', type: 'image' }] };

describe('StepLaneCard — AI 프롬프트 늘려 쓰기 (#1212)', () => {
  test('펼친 영상 단계에 늘려 쓰기 스위치가 나오고, 켜면 알린다', () => {
    const onChangePromptEnhance = vi.fn();
    renderCard({ workboardId: 'v1', workboard: videoBoard, inputs: {} }, { onChangePromptEnhance });
    const toggle = screen.getByLabelText('AI 프롬프트로 먼저 늘려 쓰기');
    fireEvent.click(toggle);
    expect(onChangePromptEnhance).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, includeImages: true }));
  });

  test('켠 단계는 텍스트 판·이미지 넘기기·지침·문서 안내를 보여 준다', async () => {
    renderCard({ workboardId: 'v1', workboard: videoBoard, inputs: {}, promptEnhance: { enabled: true, workboardId: 't1', inputs: {}, includeImages: true } });
    expect(await screen.findByRole('option', { name: '프롬프트 LLM' })).toBeInTheDocument();
    expect(screen.getByLabelText('이 단계의 이미지도 LLM 에 보여 주기')).toBeChecked();
    expect(await screen.findByText('작업판 지침 적용됨')).toBeInTheDocument();
    expect(screen.getByText(/이 단계에 연결한 문서/)).toBeInTheDocument();
    expect(screen.getByText(/AI 프롬프트: /)).toBeInTheDocument();
  });

  test('텍스트 단계에는 늘려 쓰기 설정이 없다', () => {
    renderCard({ workboardId: 't1', workboard: { _id: 't1', name: 'LLM', outputFormat: 'text', additionalInputFields: [] }, inputs: {} });
    expect(screen.queryByLabelText('AI 프롬프트로 먼저 늘려 쓰기')).toBeNull();
  });
});
