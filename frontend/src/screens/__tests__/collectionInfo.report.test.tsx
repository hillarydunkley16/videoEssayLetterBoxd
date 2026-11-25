/**
 * Reporting from a list page: a "..." menu with Report on someone else's list, none on your own.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (cb: () => void) => { const R = require('react'); R.useEffect(() => { cb(); }, []); },
}));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: () => ({ getToken: async () => 'token' }) }));

let mockIsOwner = false;
jest.mock('@/src/api/collection', () => ({
  fetchACollection: async () => ({
    id: 1,
    public_id: 'list-1',
    name: 'Best Supercuts',
    description: '',
    owner: 'someone',
    is_owner: mockIsOwner,
    essays: [],
    is_watchlist: false,
  }),
  removeFromWatchlist: jest.fn(),
  deleteCollection: jest.fn(),
}));
jest.mock('@/src/api/authPost', () => ({ useAuthPost: () => jest.fn() }));
jest.mock('@/src/api/authDelete', () => ({ useAuthDelete: () => jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const mockReport = jest.fn();
jest.mock('@/src/api/safety', () => ({
  ...jest.requireActual('@/src/api/safety'),
  reportContent: (...args: unknown[]) => mockReport(...args),
}));

import CollectionInfo from '../collectionInfo';

jest.setTimeout(20000);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockIsOwner = false;
  mockReport.mockResolvedValue({ id: 1, status: 'open' });
});

it("offers Report on someone else's list and reports it by public id", async () => {
  render(<CollectionInfo public_id="list-1" />);
  await screen.findByText('Best Supercuts');

  fireEvent.press(screen.getByLabelText('Report options'));
  fireEvent.press(await screen.findByText('Report'));
  expect(await screen.findByText('Report this list')).toBeTruthy();
  fireEvent.press(await screen.findByRole('radio', { name: 'Spam' }));
  fireEvent.press(screen.getByRole('button', { name: 'Send report' }));

  await screen.findByText('Thanks for letting us know.');
  expect(mockReport.mock.calls[0][0]).toMatchObject({ targetType: 'list', targetId: 'list-1', reason: 'spam' });
});

it('has no Report entry on your own list', async () => {
  mockIsOwner = true;
  render(<CollectionInfo public_id="list-1" />);
  await screen.findByText('Best Supercuts');
  expect(screen.queryByLabelText('Report options')).toBeNull();
});
