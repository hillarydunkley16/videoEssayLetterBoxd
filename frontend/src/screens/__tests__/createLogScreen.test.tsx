/**
 * A review validation error renders directly under the review box, on the same
 * row as the character count.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-community/datetimepicker', () => () => null);

import CreateLogScreen from '../createLogScreen';

const baseProps = {
  id: 'essay-1',
  style: {},
  reviewText: '',
  date: new Date(2026, 0, 1, 12),
  rewatch: false,
  onReviewTextChange: jest.fn(),
  onDateChange: jest.fn(),
};

jest.setTimeout(20000);

it('shows the review error next to the character count', () => {
  render(<CreateLogScreen {...baseProps} reviewError="This field may not be blank." />);
  expect(screen.getByText('This field may not be blank.')).toBeTruthy();
  expect(screen.getByText('0 characters')).toBeTruthy();
});

it('shows no error text by default', () => {
  render(<CreateLogScreen {...baseProps} />);
  expect(screen.queryByText('This field may not be blank.')).toBeNull();
  expect(screen.getByText('0 characters')).toBeTruthy();
});
