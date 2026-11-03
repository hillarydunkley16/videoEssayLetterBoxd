/**
 * A Clerk publishable key is `pk_<env>_` + base64(`<frontend api host>$`). The web shell uses the
 * host to start fetching Clerk's script in parallel with the app bundle, so the host is derived
 * from the env key and never hardcoded.
 */
import { clerkFrontendHost, clerkScriptUrl } from '../clerkHost';

const keyFor = (host: string, env = 'test') => `pk_${env}_${Buffer.from(`${host}$`).toString('base64')}`;

describe('clerkFrontendHost', () => {
  it('decodes the dev (test) instance host', () => {
    expect(clerkFrontendHost(keyFor('splendid-sunbird-55.clerk.accounts.dev'))).toBe(
      'splendid-sunbird-55.clerk.accounts.dev',
    );
  });

  it('decodes a production (live) custom domain host', () => {
    expect(clerkFrontendHost(keyFor('clerk.watchd.example', 'live'))).toBe('clerk.watchd.example');
  });

  it.each([undefined, '', 'not-a-key', 'pk_test_', 'pk_test_%%%%', 'sk_test_c2VjcmV0JA=='])(
    'returns null for %p',
    (key) => {
      expect(clerkFrontendHost(key)).toBeNull();
    },
  );

  it('rejects a decoded value that is not a plain hostname', () => {
    expect(clerkFrontendHost(`pk_test_${Buffer.from('evil.com/path"><script>$').toString('base64')}`)).toBeNull();
  });
});

describe('clerkScriptUrl', () => {
  it('is the script the Clerk SDK requests first (major-version URL, which redirects to the pinned build)', () => {
    expect(clerkScriptUrl('a.clerk.accounts.dev')).toBe(
      'https://a.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js',
    );
  });
});
