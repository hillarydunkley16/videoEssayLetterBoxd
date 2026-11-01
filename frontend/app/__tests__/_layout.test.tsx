/**
 * Root layout paint gate.
 *
 * On web the shell (nav + skeleton) must render while Clerk is still loading, so the
 * pre-rendered HTML and the first paint are not blank. Routes (<Stack>) still mount only
 * after Clerk has loaded, exactly as before. Native keeps its null gate.
 */
import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';

const mockAuth = { isLoaded: false };
const mockFonts = { loaded: true };

jest.mock('@clerk/clerk-expo', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuth,
}));
jest.mock('@clerk/clerk-expo/token-cache', () => ({ tokenCache: {} }));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return { Stack: () => <Text>STACK</Text> };
});
jest.mock('expo-share-intent', () => ({
  ShareIntentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock('../hooks/use-app-fonts', () => ({ useAppFonts: () => mockFonts }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/src/hooks/useShareIntentRouter', () => ({ useShareIntentRouter: () => {} }));
jest.mock('@/components/ui/Toast', () => ({ Toast: () => null }));
jest.mock('../../components/ui/WebNav', () => {
  const { Text } = require('react-native');
  return { WebNav: () => <Text>WEBNAV</Text> };
});
jest.mock('../../components/ui/MobileNav', () => {
  const { Text } = require('react-native');
  return { MobileNav: () => <Text>MOBILENAV</Text> };
});
jest.mock('../../components/ui/MobileTopNav', () => {
  const { Text } = require('react-native');
  return { MobileTopNav: () => <Text>MOBILETOPNAV</Text> };
});

// _layout throws at import time without a publishable key.
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
const RootLayout = require('../_layout').default;

// The first cold run has to transform the whole RN/Expo module graph.
jest.setTimeout(20000);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('root layout paint gate', () => {
  it('web, Clerk still loading: renders the nav and skeleton but not the routes', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = false;
    mockFonts.loaded = false; // fonts come from <link>/CSS on web, never gate it

    render(<RootLayout />);

    expect(screen.getByText('WEBNAV')).toBeTruthy();
    expect(screen.getByTestId('web-shell-skeleton')).toBeTruthy();
    expect(screen.queryByText('STACK')).toBeNull();
  });

  it('web, Clerk loaded: renders the routes and drops the skeleton', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    mockAuth.isLoaded = true;
    mockFonts.loaded = false;

    render(<RootLayout />);

    expect(screen.getByText('WEBNAV')).toBeTruthy();
    expect(screen.getByText('STACK')).toBeTruthy();
    expect(screen.queryByTestId('web-shell-skeleton')).toBeNull();
  });

  it('native, Clerk still loading: renders nothing', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = false;
    mockFonts.loaded = true;

    render(<RootLayout />);

    expect(screen.queryByText('STACK')).toBeNull();
    expect(screen.queryByText('MOBILETOPNAV')).toBeNull();
    expect(screen.queryByTestId('web-shell-skeleton')).toBeNull();
  });

  it('native, Clerk loaded but fonts not: still renders nothing', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockAuth.isLoaded = true;
    mockFonts.loaded = false;

    render(<RootLayout />);

    expect(screen.queryByText('STACK')).toBeNull();
    expect(screen.queryByText('MOBILETOPNAV')).toBeNull();
  });
});
