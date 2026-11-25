/**
 * The shared list card. The owner line is opt-in (search results show whose list it is; the
 * "Your Lists" grid does not), so existing screens are unchanged.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

import { ListCard } from '../ListsGrid';
import { Colors } from '@/constants/theme';

const list = {
  id: 1,
  public_id: 'abc-123',
  name: 'Film picks',
  description: '',
  owner: 'ann',
  is_owner: false,
  essays: [],
  is_watchlist: false,
};

describe('ListCard', () => {
  it('does not show the owner by default', () => {
    render(<ListCard list={list} theme={Colors.light} />);
    expect(screen.getByText('Film picks')).toBeTruthy();
    expect(screen.queryByText('by ann')).toBeNull();
  });

  it('shows the owner when asked', () => {
    render(<ListCard list={list} theme={Colors.light} showOwner />);
    expect(screen.getByText('by ann')).toBeTruthy();
  });

  it('opens the list when pressed', () => {
    render(<ListCard list={list} theme={Colors.light} />);
    fireEvent.press(screen.getByText('Film picks'));
    expect(mockPush).toHaveBeenCalledWith('/collectionDetail?publicId=abc-123');
  });
});
