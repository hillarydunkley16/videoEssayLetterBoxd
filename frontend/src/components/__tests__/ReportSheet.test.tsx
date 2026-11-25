/**
 * The sheet a signed-in user reports a log, comment, user or list in. A reason is required, the
 * details are optional, a double tap must send once, and failures must be visible and retryable.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReport = jest.fn();
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/safety', () => ({
  ...jest.requireActual('@/src/api/safety'),
  reportContent: (...args: unknown[]) => mockReport(...args),
}));

import ReportSheet from '../ReportSheet';

function setup(overrides: Partial<React.ComponentProps<typeof ReportSheet>> = {}) {
  const onClose = jest.fn();
  const utils = render(
    <ReportSheet visible targetType="log" targetId="log-uuid" onClose={onClose} {...overrides} />,
  );
  return { onClose, ...utils };
}

const send = () => screen.getByRole('button', { name: 'Send report' });

describe('ReportSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('names what is being reported and lists the reasons', () => {
    setup({ targetType: 'comment' });
    expect(screen.getByText('Report this comment')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Spam' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Harassment or bullying' })).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('Report this log')).toBeNull();
  });

  it('disables Send until a reason is chosen', () => {
    setup();
    expect(send().props.accessibilityState.disabled).toBe(true);
    fireEvent.press(send());
    expect(mockReport).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    expect(send().props.accessibilityState.disabled).toBe(false);
  });

  it('sends the target, reason and details, then confirms', async () => {
    mockReport.mockResolvedValue({ id: 1, status: 'open' });
    setup({ targetType: 'list', targetId: 'list-uuid' });

    fireEvent.press(screen.getByRole('radio', { name: 'Hate speech' }));
    fireEvent.changeText(screen.getByPlaceholderText('Add details (optional)'), 'it is rude');
    fireEvent.press(send());

    await screen.findByText('Thanks for letting us know.');
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][0]).toEqual({
      targetType: 'list',
      targetId: 'list-uuid',
      reason: 'hate',
      details: 'it is rude',
    });
    expect(screen.getByText(/within 24 hours/)).toBeTruthy();
  });

  it('sends once when Send is tapped twice (Prove-It)', async () => {
    let resolve: (value: unknown) => void = () => {};
    mockReport.mockReturnValue(new Promise((r) => (resolve = r)));
    setup();

    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    fireEvent.press(send());
    fireEvent.press(send());
    expect(mockReport).toHaveBeenCalledTimes(1);

    resolve({ id: 1, status: 'open' });
    await screen.findByText('Thanks for letting us know.');
  });

  it('shows an error and lets the user retry', async () => {
    mockReport.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ id: 2, status: 'open' });
    setup();

    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    fireEvent.press(send());
    await screen.findByText("Couldn't send your report. Please try again.");
    expect(screen.queryByText('Thanks for letting us know.')).toBeNull();

    fireEvent.press(send());
    await screen.findByText('Thanks for letting us know.');
    expect(mockReport).toHaveBeenCalledTimes(2);
  });

  it('says so when the daily limit is hit', async () => {
    mockReport.mockRejectedValue({ response: { status: 429 } });
    setup();
    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    fireEvent.press(send());
    await screen.findByText(/a lot of reports today/);
  });

  it('closes from Done after sending and from Cancel without sending', async () => {
    mockReport.mockResolvedValue({ id: 1, status: 'open' });
    const first = setup();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    expect(mockReport).not.toHaveBeenCalled();
    first.unmount();

    const second = setup();
    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    fireEvent.press(send());
    await screen.findByText('Thanks for letting us know.');
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('starts blank each time it opens', async () => {
    mockReport.mockResolvedValue({ id: 1, status: 'open' });
    const { rerender, onClose } = setup();
    fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    fireEvent.changeText(screen.getByPlaceholderText('Add details (optional)'), 'text');
    fireEvent.press(send());
    await screen.findByText('Thanks for letting us know.');

    rerender(<ReportSheet visible={false} targetType="log" targetId="x" onClose={onClose} />);
    rerender(<ReportSheet visible targetType="log" targetId="x" onClose={onClose} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send report' })).toBeTruthy());
    expect(screen.getByPlaceholderText('Add details (optional)').props.value).toBe('');
    expect(send().props.accessibilityState.disabled).toBe(true);
  });
});
