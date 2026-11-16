/**
 * The sheet a signed-out visitor rates an essay in. A rating is required, the review is optional,
 * and a double tap on "Log it" must hand the log over once.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import RatingSheet from '../RatingSheet';

const essay = { title: 'How to Do Visual Comedy', channel: 'Every Frame a Painting' };

function setup(overrides: Partial<React.ComponentProps<typeof RatingSheet>> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const utils = render(<RatingSheet visible {...essay} onSubmit={onSubmit} onCancel={onCancel} {...overrides} />);
  return { onSubmit, onCancel, ...utils };
}

describe('RatingSheet', () => {
  it('shows the essay title and channel', () => {
    setup();
    expect(screen.getByText('How to Do Visual Comedy')).toBeTruthy();
    expect(screen.getByText('Every Frame a Painting')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('How to Do Visual Comedy')).toBeNull();
  });

  it('disables Log it until a rating is chosen', () => {
    const { onSubmit } = setup();
    expect(screen.getByRole('button', { name: 'Log it' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the chosen rating with an empty review', () => {
    const { onSubmit } = setup();
    fireEvent.press(screen.getByLabelText('Rate 4 out of 5'));
    expect(screen.getByRole('button', { name: 'Log it' }).props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).toHaveBeenCalledWith(4, '');
  });

  it('keeps the review hidden until asked for, then submits what was typed', () => {
    const { onSubmit } = setup();
    expect(screen.queryByPlaceholderText('Write the review you would send a friend')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Add a review' }));
    fireEvent.changeText(screen.getByPlaceholderText('Write the review you would send a friend'), 'Sharp and funny');
    fireEvent.press(screen.getByLabelText('Rate 5 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));

    expect(onSubmit).toHaveBeenCalledWith(5, 'Sharp and funny');
  });

  it('hands the log over once when Log it is tapped twice (Prove-It)', () => {
    const { onSubmit } = setup();
    fireEvent.press(screen.getByLabelText('Rate 3 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel from Cancel without submitting', () => {
    const { onSubmit, onCancel } = setup();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('starts fresh when it is opened again', () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<RatingSheet visible {...essay} onSubmit={onSubmit} onCancel={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Rate 4 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));

    rerender(<RatingSheet visible={false} {...essay} onSubmit={onSubmit} onCancel={jest.fn()} />);
    rerender(<RatingSheet visible {...essay} onSubmit={onSubmit} onCancel={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Log it' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByLabelText('Rate 2 out of 5'));
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith(2, '');
  });

  it('can reopen with the rating and review the visitor already gave (Back from the account sheet)', () => {
    const { onSubmit } = setup({ initialRating: 4, initialReview: 'Sharp and funny' });
    expect(screen.getByRole('button', { name: 'Log it' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByDisplayValue('Sharp and funny')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).toHaveBeenCalledWith(4, 'Sharp and funny');
  });

  it('limits the review to the 200 characters the backend accepts', () => {
    setup();
    fireEvent.press(screen.getByRole('button', { name: 'Add a review' }));
    expect(screen.getByPlaceholderText('Write the review you would send a friend').props.maxLength).toBe(200);
  });
});
