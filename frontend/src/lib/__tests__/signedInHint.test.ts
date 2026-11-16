/**
 * A browser-only hint that this visitor was signed in last time, so the home route can show a
 * feed skeleton (not the marketing hero) while Clerk loads. It is only a hint: Clerk decides.
 * Storage can be missing or throw (private windows, blocked site data), and must never break.
 */
import { SIGNED_IN_HINT_KEY, clearSignedInHint, setSignedInHint } from '../signedInHint';

type Store = Record<string, string>;

function installStorage(data: Store = {}) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
      removeItem: (k: string) => {
        delete data[k];
      },
    },
  });
  return data;
}

afterEach(() => {
  // @ts-expect-error restore "no storage"
  delete globalThis.localStorage;
});

describe('signedInHint', () => {
  it('stores a flag under the shared key (the inline script in +html reads the same key)', () => {
    const data = installStorage();
    setSignedInHint();
    expect(data).toEqual({ [SIGNED_IN_HINT_KEY]: '1' });
  });

  it('is gone after clear', () => {
    const data = installStorage();
    setSignedInHint();
    clearSignedInHint();
    expect(data).toEqual({});
  });

  it('does not throw and reports no hint when storage is missing', () => {
    expect(() => setSignedInHint()).not.toThrow();
    expect(() => clearSignedInHint()).not.toThrow();
  });

  it('does not throw when storage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => setSignedInHint()).not.toThrow();
    expect(() => clearSignedInHint()).not.toThrow();
  });
});
