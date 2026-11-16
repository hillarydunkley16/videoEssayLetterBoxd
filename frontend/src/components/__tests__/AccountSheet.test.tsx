/**
 * The sheet that asks a visitor to make an account once they have rated an essay. It shows the
 * log they are about to save and sends them to the existing Clerk screens, never rebuilding them.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AccountSheet from '../AccountSheet';

const calls: string[] = [];
const mockPush = jest.fn((href: string) => calls.push(`push:${href}`));
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('../GoogleButton', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>GOOGLE</Text> };
});

const log = { title: 'How to Do Visual Comedy', thumbnail: 'https://img.test/t.jpg', rating: 4 };

function setup(overrides: Partial<React.ComponentProps<typeof AccountSheet>> = {}) {
  calls.length = 0;
  const onBack = jest.fn(() => calls.push('back'));
  const onDismiss = jest.fn(() => calls.push('dismiss'));
  render(<AccountSheet visible {...log} onBack={onBack} onDismiss={onDismiss} {...overrides} />);
  return { onBack, onDismiss };
}

beforeEach(() => jest.clearAllMocks());

describe('AccountSheet', () => {
  it('shows the log that is waiting to be saved', () => {
    setup();
    expect(screen.getByText('Create an account to save it')).toBeTruthy();
    expect(screen.getByText('How to Do Visual Comedy')).toBeTruthy();
    expect(screen.getByLabelText('Rated 4 out of 5')).toBeTruthy();
  });

  it('offers Google sign-in', () => {
    setup();
    expect(screen.getByText('GOOGLE')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    setup({ visible: false });
    expect(screen.queryByText('Create an account to save it')).toBeNull();
  });

  it('closes itself, then opens the existing sign-up screen for email', () => {
    setup();
    fireEvent.press(screen.getByRole('button', { name: 'Create account with email' }));
    expect(calls).toEqual(['dismiss', 'push:/(auth)/sign-up']);
  });

  it('closes itself, then opens the existing sign-in screen for Log in', () => {
    setup();
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(calls).toEqual(['dismiss', 'push:/(auth)/sign-in']);
  });

  it('goes back to the rating without navigating', () => {
    const { onBack } = setup();
    fireEvent.press(screen.getByRole('button', { name: 'Back to rating' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
