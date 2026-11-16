/**
 * The tick is held in storage as well as in the form, because the Google sign-up redirect reloads
 * the page and the server is told only after sign-in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { readAgeConfirmation } from '@/src/lib/ageConfirmation';
import AgeConfirmation, { AGE_CONFIRMATION_LABEL } from '../AgeConfirmation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

function Harness({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = React.useState(initial);
  return <AgeConfirmation checked={checked} onChange={setChecked} />;
}

const box = () => screen.getByRole('checkbox', { name: AGE_CONFIRMATION_LABEL });

it('holds the confirmation in storage once ticked', async () => {
  render(<Harness />);
  fireEvent.press(box());
  expect(box().props.accessibilityState.checked).toBe(true);
  await waitFor(async () => expect(await readAgeConfirmation()).not.toBeNull());
});

it('removes it again when the visitor unticks', async () => {
  render(<Harness />);
  fireEvent.press(box());
  await waitFor(async () => expect(await readAgeConfirmation()).not.toBeNull());
  fireEvent.press(box());
  expect(box().props.accessibilityState.checked).toBe(false);
  await waitFor(async () => expect(await readAgeConfirmation()).toBeNull());
});

it('stores nothing until the visitor ticks', async () => {
  render(<Harness />);
  await new Promise((r) => setTimeout(r, 20));
  expect(await readAgeConfirmation()).toBeNull();
});
