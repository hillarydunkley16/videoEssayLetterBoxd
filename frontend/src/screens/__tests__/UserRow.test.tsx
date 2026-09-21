/**
 * Shared person row (followers/following lists and People search). Presentational: the
 * parent owns busy state and what a press does; the row reports presses by user id.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import UserRow from '../UserRow';

const user = { id: 7, username: 'ann', imageUrl: null, is_following: false };

function setup(props: Partial<React.ComponentProps<typeof UserRow>> = {}) {
  const onOpen = jest.fn();
  const onToggleFollow = jest.fn();
  render(
    <UserRow user={user} showFollow busy={false} onOpen={onOpen} onToggleFollow={onToggleFollow} {...props} />
  );
  return { onOpen, onToggleFollow };
}

describe('UserRow', () => {
  it('shows the username and a Follow button for someone not followed', () => {
    setup();
    expect(screen.getByText('ann')).toBeTruthy();
    expect(screen.getByText('Follow')).toBeTruthy();
  });

  it('shows Following when already followed', () => {
    setup({ user: { ...user, is_following: true } });
    expect(screen.getByText('Following')).toBeTruthy();
  });

  it('hides the follow button on the viewer’s own row', () => {
    setup({ showFollow: false });
    expect(screen.queryByTestId('follow-toggle-7')).toBeNull();
  });

  it('reports the user id when the person or the follow button is pressed', () => {
    const { onOpen, onToggleFollow } = setup();
    fireEvent.press(screen.getByText('ann'));
    expect(onOpen).toHaveBeenCalledWith(7);
    fireEvent.press(screen.getByTestId('follow-toggle-7'));
    expect(onToggleFollow).toHaveBeenCalledWith(7);
  });

  it('ignores presses on both buttons while busy', () => {
    const onRemove = jest.fn();
    const { onToggleFollow } = setup({ busy: true, onRemove });
    fireEvent.press(screen.getByTestId('follow-toggle-7'));
    fireEvent.press(screen.getByTestId('remove-follower-7'));
    expect(onToggleFollow).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('shows no Remove button unless an onRemove handler is given', () => {
    setup();
    expect(screen.queryByTestId('remove-follower-7')).toBeNull();
  });

  it('calls onRemove with the id', () => {
    const onRemove = jest.fn();
    setup({ onRemove });
    fireEvent.press(screen.getByTestId('remove-follower-7'));
    expect(onRemove).toHaveBeenCalledWith(7);
  });
});
