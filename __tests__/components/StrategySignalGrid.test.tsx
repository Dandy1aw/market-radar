/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { StrategySignalGrid } from '@/components/strategy/StrategySignalGrid';
import type { StrategySignal } from '@/lib/strategy-signals';

const signals: StrategySignal[] = [
  {
    title: '趋势',
    value: '上升趋势',
    detail: '价格保持在主要均线上方。',
    tone: 'positive',
  },
  {
    title: '动作',
    value: '避免追高',
    detail: '继续定投即可。',
    tone: 'warning',
  },
];

describe('StrategySignalGrid', () => {
  it('renders signal titles, values, and details', () => {
    render(<StrategySignalGrid signals={signals} />);

    expect(screen.getByText('趋势')).toBeInTheDocument();
    expect(screen.getByText('上升趋势')).toBeInTheDocument();
    expect(screen.getByText('避免追高')).toBeInTheDocument();
    expect(screen.getByText('继续定投即可。')).toBeInTheDocument();
  });

  it('renders nothing when no signals are provided', () => {
    const { container } = render(<StrategySignalGrid signals={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
