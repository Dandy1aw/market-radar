/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WatchlistTable } from '@/components/watchlist/WatchlistTable';
import type { Watchlist } from '@/types';

const rows: Watchlist[] = [
  { id: 1, symbol: 'QQQ', name: '纳指ETF', market: 'US', asset_type: 'etf', category: 'tech', enabled: true, created_at: '', updated_at: '' },
  { id: 2, symbol: 'TSLA', name: '特斯拉', market: 'US', asset_type: 'stock', category: 'ev', enabled: false, created_at: '', updated_at: '' },
];

beforeEach(() => {
  localStorage.setItem('adminToken', 't');
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
});
afterEach(() => { localStorage.clear(); jest.resetAllMocks(); });

describe('WatchlistTable', () => {
  it('renders one row per item', () => {
    render(<WatchlistTable rows={rows} onChange={() => {}} />);
    expect(screen.getByText('QQQ')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });

  it('toggling enabled sends PATCH with Bearer token', async () => {
    const onChange = jest.fn();
    render(<WatchlistTable rows={rows} onChange={onChange} />);
    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[0]); // toggle QQQ (currently enabled → flip to false)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/watchlist/1');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer t');
    expect(JSON.parse(init.body)).toEqual({ enabled: false });
    expect(onChange).toHaveBeenCalled();
  });

  it('clicking 删除 twice (with confirm) sends DELETE', async () => {
    const onChange = jest.fn();
    render(<WatchlistTable rows={rows} onChange={onChange} />);
    // First click shows inline confirmation
    const buttons = screen.getAllByRole('button', { name: /删除/ });
    fireEvent.click(buttons[0]);
    // Second click on 确认删除 fires the DELETE
    const confirmBtn = await screen.findByRole('button', { name: /确认删除/ });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/watchlist/1');
    expect(init.method).toBe('DELETE');
    expect(onChange).toHaveBeenCalled();
  });
});
