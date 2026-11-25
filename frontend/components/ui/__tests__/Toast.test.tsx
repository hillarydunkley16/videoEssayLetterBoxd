import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { Toast } from '../Toast';
import { showToast } from '@/src/helpers/toast';

jest.useFakeTimers();

it('shows a message when showToast is called, then hides it', () => {
  render(<Toast />);
  expect(screen.queryByText('Log created')).toBeNull();

  act(() => showToast('Log created'));
  expect(screen.getByText('Log created')).toBeTruthy();

  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.queryByText('Log created')).toBeNull();
});
