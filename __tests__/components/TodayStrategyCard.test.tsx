/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { TodayStrategyCard } from '@/components/dashboard/TodayStrategyCard';
import { mockDashboard } from '@/lib/mock-data';

describe('TodayStrategyCard', () => {
  it('renders the dashboard strategy summary and signals', () => {
    render(<TodayStrategyCard data={mockDashboard} />);

    expect(screen.getByText('今日操作建议')).toBeInTheDocument();
    expect(screen.getByText('趋势偏强，避免追高')).toBeInTheDocument();
    expect(screen.getByText('趋势')).toBeInTheDocument();
    expect(screen.getByText('动作')).toBeInTheDocument();
  });
});
