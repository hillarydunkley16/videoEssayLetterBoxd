/**
 * The feature cards' icons come from an icon font that loads long after first paint; until then
 * the icon component renders nothing. Each icon therefore sits in a fixed-size box so the cards
 * are the same height before and after the font arrives (otherwise the closing section jumps).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import SignedOutHomeScreen from '../SignedOutHomeScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/src/api/videos', () => ({
  fetchPopularVideoEssaysPublic: jest.fn(() => new Promise(() => {})),
}));

describe('SignedOutHomeScreen feature icons', () => {
  it('reserves a 24x24 box for each feature icon so layout does not change when the icon font loads', () => {
    render(<SignedOutHomeScreen />);

    const slots = screen.getAllByTestId('feature-icon-slot');
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      const style = StyleSheet.flatten(slot.props.style);
      expect(style.width).toBe(24);
      expect(style.height).toBe(24);
    }
  });
});
