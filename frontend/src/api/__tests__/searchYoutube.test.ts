/**
 * searchYoutube is the signed-out landing page's search call. Unlike fetchYoutubeResults it must
 * say why a search came back empty, so the page can show "try again in a minute" for a 429.
 */
import axios from 'axios';

import { fetchYoutubeResults, searchDataBasePublic, searchYoutube } from '../videos';

jest.mock('axios');
jest.mock('expo-crypto', () => ({}));
jest.mock('@clerk/clerk-expo', () => ({ useAuth: jest.fn() }));
jest.mock('../client', () => ({ authFetch: jest.fn(), API_BASE_URL: 'http://api.test' }));
jest.mock('../authPost', () => ({ useAuthPost: jest.fn() }));

const post = axios.post as unknown as jest.Mock;
const get = axios.get as unknown as jest.Mock;

const apiRow = {
  link: 'https://www.youtube.com/watch?v=abc12345678',
  title: 'How to Do Visual Comedy',
  thumbnail: { static: 'https://img.test/t.jpg' },
  channel: { name: 'Every Frame a Painting', link: 'https://yt.test/c' },
  views: 1234,
};

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('searchYoutube', () => {
  it('posts the query to search/ with no auth header and maps the rows', async () => {
    post.mockResolvedValue({ data: { video_results: [apiRow] } });
    const signal = new AbortController().signal;

    const out = await searchYoutube('visual comedy', signal);

    expect(post).toHaveBeenCalledWith(
      'http://api.test/search/',
      { q: 'visual comedy', location: 'us', language: 'en' },
      { signal },
    );
    expect(out.status).toBe('ok');
    expect(out.results).toEqual([
      {
        source: 'api',
        video: {
          youtube_url: apiRow.link,
          title: apiRow.title,
          thumbnail: 'https://img.test/t.jpg',
          channel_name: 'Every Frame a Painting',
          views: 1234,
          channel_url: 'https://yt.test/c',
        },
      },
    ]);
  });

  it('returns ok with no results when the response has none', async () => {
    post.mockResolvedValue({ data: {} });
    await expect(searchYoutube('nothing')).resolves.toEqual({ results: [], status: 'ok' });
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'unavailable'],
    [502, 'error'],
    [500, 'error'],
  ])('maps HTTP %i to %s', async (httpStatus, expected) => {
    post.mockRejectedValue(httpError(httpStatus));
    await expect(searchYoutube('q')).resolves.toEqual({ results: [], status: expected });
  });

  it('maps a network failure to error', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await expect(searchYoutube('q')).resolves.toEqual({ results: [], status: 'error' });
  });

  it('maps an aborted request to cancelled so the page can ignore it', async () => {
    post.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }));
    await expect(searchYoutube('q')).resolves.toEqual({ results: [], status: 'cancelled' });
  });
});

describe('fetchYoutubeResults (existing callers)', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

  it('still returns the mapped rows', async () => {
    post.mockResolvedValue({ data: { video_results: [apiRow] } });
    const rows = await fetchYoutubeResults('visual comedy');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'api', video: { title: apiRow.title } });
  });

  it('still returns [] on any failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    post.mockRejectedValue(httpError(429));
    await expect(fetchYoutubeResults('q')).resolves.toEqual([]);
  });
});

describe('searchDataBasePublic', () => {
  it('searches the essays table without a token and tags rows as database results', async () => {
    const essay = { id: 1, public_id: 'p1', title: 'Line Goes Up' };
    get.mockResolvedValue({ data: { results: [essay] } });

    const rows = await searchDataBasePublic('line goes & up');

    expect(get).toHaveBeenCalledWith('http://api.test/VideoEssays/?search=line%20goes%20%26%20up');
    expect(rows).toEqual([{ source: 'database', video: essay }]);
  });

  it('returns [] on failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    get.mockRejectedValue(new Error('down'));
    await expect(searchDataBasePublic('q')).resolves.toEqual([]);
  });
});
