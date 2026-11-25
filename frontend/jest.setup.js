// AsyncStorage has no native module under Jest. Several screens now touch it indirectly (the age
// tick and the pending log), so every suite gets the library's in-memory mock by default.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
