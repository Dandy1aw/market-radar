/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders label text', () => {
    render(<Badge variant="positive" label="强关注" />);
    expect(screen.getByText('强关注')).toBeInTheDocument();
  });

  it('applies positive styles for positive variant', () => {
    const { container } = render(<Badge variant="positive" label="强关注" />);
    expect(container.firstChild).toHaveClass('text-green-400');
  });

  it('applies negative styles for negative variant', () => {
    const { container } = render(<Badge variant="negative" label="风险观察" />);
    expect(container.firstChild).toHaveClass('text-red-400');
  });

  it('applies warning styles for warning variant', () => {
    const { container } = render(<Badge variant="warning" label="回调关注" />);
    expect(container.firstChild).toHaveClass('text-amber-400');
  });
});
