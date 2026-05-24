/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { RangeSelector } from '@/components/chart/RangeSelector';

describe('RangeSelector', () => {
  it('renders all range buttons', () => {
    render(<RangeSelector value="3m" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '3M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3Y' })).toBeInTheDocument();
  });

  it('calls onChange with the matching range when clicked', () => {
    const onChange = jest.fn();
    render(<RangeSelector value="3m" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '1Y' }));

    expect(onChange).toHaveBeenCalledWith('1y');
  });

  it('marks the active range as selected', () => {
    render(<RangeSelector value="6m" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '6M' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
