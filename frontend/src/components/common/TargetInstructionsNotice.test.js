import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TargetInstructionsNotice from './TargetInstructionsNotice';

describe('TargetInstructionsNotice (#1109)', () => {
  test('지침이 비어 있으면 아무것도 그리지 않는다 — 적용되지 않는 것을 적용됨으로 보이면 안 된다', () => {
    const { container } = render(<TargetInstructionsNotice instructions="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  test('적용됨 표시가 보이고, 지침 보기를 누르면 본문이 펼쳐진다', () => {
    render(<TargetInstructionsNotice instructions={'영어 한 문단으로 쓴다.\n태그 나열 금지.'} />);
    expect(screen.getByText('작업판 지침 적용됨')).toBeInTheDocument();
    expect(screen.queryByText(/태그 나열 금지/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '지침 보기' }));
    expect(screen.getByText(/태그 나열 금지/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
  });
});
