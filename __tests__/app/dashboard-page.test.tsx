import DashboardPage from '@/app/page';
import { mockDashboard } from '@/lib/mock-data';
import { DashboardIndexCharts } from '@/components/dashboard/DashboardIndexCharts';
import type { ReactElement } from 'react';

jest.mock('@/components/dashboard/MarketStatusBanner', () => ({
  MarketStatusBanner: () => <div data-testid="market-status" />,
}));
jest.mock('@/components/dashboard/IndexCard', () => ({
  IndexCard: () => <div data-testid="index-card" />,
}));
jest.mock('@/components/dashboard/DashboardIndexCharts', () => ({
  DashboardIndexCharts: () => <div data-testid="dashboard-index-charts" />,
}));
jest.mock('@/components/dashboard/EtfGrid', () => ({
  EtfGrid: () => <div data-testid="etf-grid" />,
}));
jest.mock('@/components/dashboard/RecommendationSection', () => ({
  RecommendationSection: () => <div data-testid="recommendation-section" />,
}));
jest.mock('@/components/dashboard/DcaSuggestion', () => ({
  DcaSuggestion: () => <div data-testid="dca-suggestion" />,
}));
jest.mock('@/components/dashboard/DailyReportCard', () => ({
  DailyReportCard: () => <div data-testid="daily-report" />,
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockDashboard,
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DashboardPage', () => {
  it('renders the dashboard index charts without removing existing sections', async () => {
    const element = await DashboardPage();

    const children = element.props.children as ReactElement[];
    expect(children.some(child => child.type === DashboardIndexCharts)).toBe(
      true,
    );
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/dashboard', {
      cache: 'no-store',
    });
  });
});
