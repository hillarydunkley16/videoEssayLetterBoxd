/**
 * extractYoutubeId — parses a shared YouTube URL (or share text containing one) into
 * a youtube_id, per tasks/spec-share-to-app.md T4. Pure function, no network/native deps.
 */
import { extractYoutubeId } from '../shareIntent';

describe('extractYoutubeId', () => {
  it('extracts the id from a youtu.be short link', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a youtu.be link with a query string (e.g. ?si=...)', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=abc123')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a full youtube.com/watch?v= link', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a youtube.com/watch link with v= anywhere in the query string', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('does not false-positive on a non-YouTube URL that happens to have a v= param', () => {
    expect(extractYoutubeId('https://example.com/page?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('extracts the id from a youtube.com/shorts link', () => {
    expect(extractYoutubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id when the shared text has surrounding words/title before the URL', () => {
    expect(extractYoutubeId('Check out this video! https://youtu.be/dQw4w9WgXcQ via @someone')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('returns null for text with no YouTube URL', () => {
    expect(extractYoutubeId('just some random shared text, no link here')).toBeNull();
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractYoutubeId('https://vimeo.com/12345678')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractYoutubeId('')).toBeNull();
  });
});
