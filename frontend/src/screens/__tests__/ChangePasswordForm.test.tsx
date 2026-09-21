/**
 * Change password form: validates locally, calls Clerk's updatePassword, shows
 * Clerk's error message on failure, and is hidden for password-less accounts.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockUpdatePassword = jest.fn();
let mockUser: Record<string, unknown> | null;
jest.mock('@clerk/clerk-expo', () => ({ useUser: () => ({ user: mockUser }) }));

import ChangePasswordForm from '../ChangePasswordForm';

jest.setTimeout(20000);

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { passwordEnabled: true, updatePassword: mockUpdatePassword };
});

function fill(cur: string, next: string, confirm: string) {
  fireEvent.changeText(screen.getByLabelText('Current password'), cur);
  fireEvent.changeText(screen.getByLabelText('New password'), next);
  fireEvent.changeText(screen.getByLabelText('Confirm new password'), confirm);
  fireEvent.press(screen.getByLabelText('Update password'));
}

it('is hidden when the account has no password', () => {
  mockUser = { passwordEnabled: false, updatePassword: mockUpdatePassword };
  render(<ChangePasswordForm />);
  expect(screen.queryByLabelText('Update password')).toBeNull();
});

it('blocks empty fields and mismatched confirmation', async () => {
  render(<ChangePasswordForm />);
  fill('', 'a', 'a');
  expect(await screen.findByText('Fill in all fields.')).toBeTruthy();
  fill('old', 'newpass1', 'different');
  expect(await screen.findByText("New passwords don't match.")).toBeTruthy();
  expect(mockUpdatePassword).not.toHaveBeenCalled();
});

it('calls updatePassword and confirms on success', async () => {
  mockUpdatePassword.mockResolvedValue({});
  render(<ChangePasswordForm />);
  fill('old', 'newpass1', 'newpass1');
  await waitFor(() => expect(screen.getByText('Password updated.')).toBeTruthy());
  expect(mockUpdatePassword).toHaveBeenCalledWith({ currentPassword: 'old', newPassword: 'newpass1' });
});

it('shows the Clerk error message on failure', async () => {
  mockUpdatePassword.mockRejectedValue({ errors: [{ longMessage: 'Password is incorrect.' }] });
  render(<ChangePasswordForm />);
  fill('bad', 'newpass1', 'newpass1');
  expect(await screen.findByText('Password is incorrect.')).toBeTruthy();
  expect(screen.queryByText('Password updated.')).toBeNull();
});
