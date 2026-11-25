/**
 * Delete account: nothing happens until the username is typed; server data is
 * deleted first and Clerk only afterwards; failures leave the user signed in.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));

const mockClerkDelete = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({ user: { username: 'me', delete: mockClerkDelete } }),
}));

const calls: string[] = [];
const mockServerDelete = jest.fn();
jest.mock('@/src/api/account', () => ({ deleteAccountData: (...a: unknown[]) => mockServerDelete(...a) }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));

import DeleteAccountSection from '../DeleteAccountSection';

jest.setTimeout(20000);

beforeEach(() => {
  jest.clearAllMocks();
  calls.length = 0;
  mockServerDelete.mockImplementation(async () => { calls.push('server'); });
  mockClerkDelete.mockImplementation(async () => { calls.push('clerk'); });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

function openAndType(text: string) {
  fireEvent.press(screen.getByLabelText('Delete account'));
  fireEvent.changeText(screen.getByLabelText('Confirm deletion'), text);
}

it('does nothing until the username is typed exactly', () => {
  render(<DeleteAccountSection />);
  openAndType('nope');
  fireEvent.press(screen.getByLabelText('Permanently delete account'));
  expect(mockServerDelete).not.toHaveBeenCalled();
  expect(mockClerkDelete).not.toHaveBeenCalled();
});

it('deletes server data then Clerk, then goes to /', async () => {
  render(<DeleteAccountSection />);
  openAndType('me');
  fireEvent.press(screen.getByLabelText('Permanently delete account'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(calls).toEqual(['server', 'clerk']);
});

it('skips Clerk and stays put when the server delete fails', async () => {
  mockServerDelete.mockRejectedValue(new Error('500'));
  render(<DeleteAccountSection />);
  openAndType('me');
  fireEvent.press(screen.getByLabelText('Permanently delete account'));
  expect(await screen.findByText(/Nothing was changed/)).toBeTruthy();
  expect(mockClerkDelete).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('shows an error and does not navigate when Clerk delete fails', async () => {
  mockClerkDelete.mockRejectedValue(new Error('not allowed'));
  render(<DeleteAccountSection />);
  openAndType('me');
  fireEvent.press(screen.getByLabelText('Permanently delete account'));
  expect(await screen.findByText(/sign-in couldn't be deleted/)).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

it('cancel collapses the confirmation', () => {
  render(<DeleteAccountSection />);
  openAndType('me');
  fireEvent.press(screen.getByLabelText('Cancel'));
  expect(screen.queryByLabelText('Confirm deletion')).toBeNull();
});
