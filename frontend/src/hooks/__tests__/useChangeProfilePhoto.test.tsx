/**
 * Photo change: cancelled picker is a no-op; success uploads to Clerk then
 * syncs the new URL to the backend; failures surface an error message.
 */
import { renderHook, act } from '@testing-library/react-native';

const mockPick = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...a: unknown[]) => mockPick(...a),
  MediaTypeOptions: { Images: 'Images' },
}));

const mockSetProfileImage = jest.fn();
const mockReload = jest.fn();
jest.mock('@clerk/clerk-expo', () => ({
  useUser: () => ({
    user: { imageUrl: 'https://img/new.png', setProfileImage: mockSetProfileImage, reload: mockReload },
  }),
}));

const mockSync = jest.fn();
jest.mock('@/src/api/users', () => ({ updateProfileImageAPI: (...a: unknown[]) => mockSync(...a) }));
jest.mock('@/src/api/authUpdate', () => ({ useAuthUpdate: () => 'authUpdate' }));

import { useChangeProfilePhoto } from '../useChangeProfilePhoto';

jest.setTimeout(20000);

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).fetch = jest.fn().mockResolvedValue({ blob: async () => 'blob' });
});

it('does nothing when the picker is cancelled', async () => {
  mockPick.mockResolvedValue({ canceled: true });
  const { result } = renderHook(() => useChangeProfilePhoto());
  await act(async () => { await result.current.changePhoto(); });
  expect(mockSetProfileImage).not.toHaveBeenCalled();
  expect(mockSync).not.toHaveBeenCalled();
  expect(result.current.error).toBeNull();
});

it('uploads to Clerk then syncs the backend', async () => {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://x' }] });
  const { result } = renderHook(() => useChangeProfilePhoto());
  await act(async () => { await result.current.changePhoto(); });
  expect(mockSetProfileImage).toHaveBeenCalledWith({ file: 'blob' });
  expect(mockReload).toHaveBeenCalled();
  expect(mockSync).toHaveBeenCalledWith('https://img/new.png', 'authUpdate');
});

it('sets an error when the upload fails', async () => {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://x' }] });
  mockSetProfileImage.mockRejectedValue(new Error('nope'));
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { result } = renderHook(() => useChangeProfilePhoto());
  await act(async () => { await result.current.changePhoto(); });
  expect(result.current.error).toMatch(/couldn't update/i);
  expect(mockSync).not.toHaveBeenCalled();
  spy.mockRestore();
});
