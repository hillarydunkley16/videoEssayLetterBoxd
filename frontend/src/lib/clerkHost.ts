// A Clerk publishable key is `pk_<env>_` + base64(`<frontend api host>$`). Decoding it gives the
// host Clerk's script is served from, so the web shell can start fetching it early without
// hardcoding a host (dev and production instances differ).
const HOSTNAME = /^[a-z0-9.-]+$/i;

export function clerkFrontendHost(publishableKey: string | undefined): string | null {
  const match = publishableKey?.match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    if (!decoded.endsWith('$')) return null;
    const host = decoded.slice(0, -1);
    return HOSTNAME.test(host) ? host : null;
  } catch {
    return null;
  }
}

// The first script URL the Clerk SDK requests (the major-version path, which redirects to the
// pinned build). Preloading this exact URL lets the SDK's own request reuse it.
export const clerkScriptUrl = (host: string) => `https://${host}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
