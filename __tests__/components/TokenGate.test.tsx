/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenGate } from '@/components/watchlist/TokenGate';

beforeEach(() => { localStorage.clear(); });

describe('TokenGate', () => {
  it('shows the token prompt when no token is stored', () => {
    render(<TokenGate><div>secret content</div></TokenGate>);
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ADMIN_TOKEN/i)).toBeInTheDocument();
  });

  it('renders children once a token is saved', () => {
    render(<TokenGate><div>secret content</div></TokenGate>);
    const input = screen.getByPlaceholderText(/ADMIN_TOKEN/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'my-token' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));
    expect(localStorage.getItem('adminToken')).toBe('my-token');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });

  it('renders children immediately if a token is already in localStorage', () => {
    localStorage.setItem('adminToken', 'preset');
    render(<TokenGate><div>secret content</div></TokenGate>);
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
