const YOUTU_BE_PATTERN = /youtu\.be\/([A-Za-z0-9_-]{11})/;
const SHORTS_PATTERN = /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/;
const WATCH_QUERY_PATTERN = /youtube\.com\/watch\?(\S*)/;
const V_PARAM_PATTERN = /(?:^|&)v=([A-Za-z0-9_-]{11})/;

/**
 * Pulls a youtube_id out of shared text — a bare URL, or a share payload that also
 * includes surrounding words/title before the link (YouTube's Android share sometimes
 * does this). Returns null when no YouTube video URL is found.
 */
export function extractYoutubeId(sharedText: string): string | null {
  const directMatch = sharedText.match(YOUTU_BE_PATTERN) ?? sharedText.match(SHORTS_PATTERN);
  if (directMatch) return directMatch[1];

  const watchQuery = sharedText.match(WATCH_QUERY_PATTERN);
  if (watchQuery) {
    const vParam = watchQuery[1].match(V_PARAM_PATTERN);
    if (vParam) return vParam[1];
  }

  return null;
}
