import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// #1142 — 같은 (서버 종류, 출력 형식)에 템플릿이 여럿이면 "시작 양식" 을 고르게 한다
vi.mock('../../services/api', () => ({
  serverAPI: {
    getServers: vi.fn().mockResolvedValue({
      data: { data: { servers: [
        { _id: 'srv-openai', name: 'GPT', serverType: 'OpenAI' },
        { _id: 'srv-comfy', name: 'moss', serverType: 'ComfyUI' },
      ] } },
    }),
  },
  workboardAPI: {},
}));

import { WorkboardCreateForm } from './WorkboardManagement';

function renderForm(onSave = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkboardCreateForm onSave={onSave} onCancel={() => {}} />
    </QueryClientProvider>
  );
  return onSave;
}

// MUI Select 는 mouseDown 으로 열고 목록(listbox)에서 고른다
async function pick(combobox, optionText) {
  fireEvent.mouseDown(combobox);
  const listbox = await screen.findByRole('listbox');
  fireEvent.click(within(listbox).getByText(optionText));
}

describe('작업판 만들기 — 시작 양식 고르기 (#1142)', () => {
  test('OpenAI 서버면 시작 양식이 보이고, 고른 id 가 저장 데이터에 실린다', async () => {
    const onSave = renderForm();
    fireEvent.change(screen.getByLabelText('작업판 이름'), { target: { value: 'GIF 판' } });

    const [serverSelect] = screen.getAllByRole('combobox');
    await waitFor(() => expect(serverSelect).not.toHaveAttribute('aria-disabled', 'true'));
    await pick(serverSelect, 'GPT (OpenAI)');

    expect(await screen.findByText('시작 양식', { selector: 'label' })).toBeInTheDocument();
    const comboboxes = screen.getAllByRole('combobox');
    await pick(comboboxes[comboboxes.length - 1], 'GPT Image 2.6 GIF');

    fireEvent.click(screen.getByRole('button', { name: '생성' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ serverId: 'srv-openai', serverType: 'OpenAI', templateId: 'gpt-image-2.6-gif' });
  });

  test('템플릿이 하나뿐인 서버(ComfyUI 이미지)는 시작 양식을 그리지 않는다', async () => {
    renderForm();
    const [serverSelect] = screen.getAllByRole('combobox');
    await waitFor(() => expect(serverSelect).not.toHaveAttribute('aria-disabled', 'true'));
    await pick(serverSelect, 'moss (ComfyUI)');
    await waitFor(() => expect(screen.getByText(/선택된 서버 타입/)).toBeInTheDocument());
    expect(screen.queryByText('시작 양식', { selector: 'label' })).not.toBeInTheDocument();
  });
});
