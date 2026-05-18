/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddSymbolForm } from '@/components/watchlist/AddSymbolForm';

beforeEach(() => {
  localStorage.setItem('adminToken', 'test-token');
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({ row: { id: 99, symbol: 'AVGO', name: 'Broadcom', market: 'US', asset_type: 'stock', enabled: true } }),
  })) as unknown as typeof fetch;
});

afterEach(() => { localStorage.clear(); jest.resetAllMocks(); });

describe('AddSymbolForm', () => {
  it('submits a POST with Bearer token and calls onAdded', async () => {
    const onAdded = jest.fn();
    render(<AddSymbolForm onAdded={onAdded} />);

    fireEvent.change(screen.getByPlaceholderText(/symbol/i), { target: { value: 'avgo' } });
    fireEvent.change(screen.getByPlaceholderText(/名称/), { target: { value: 'Broadcom' } });
    fireEvent.change(screen.getByLabelText(/市场/), { target: { value: 'US' } });
    fireEvent.change(screen.getByLabelText(/类型/), { target: { value: 'stock' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('/api/watchlist');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(callArgs[1].body);
    expect(body.symbol).toBe('avgo');
  });

  it('does not submit when symbol is empty', () => {
    render(<AddSymbolForm onAdded={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
