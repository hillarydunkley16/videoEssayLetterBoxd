/**
 * getOrCreateVideoEssayByYoutubeId — backs the share-to-app flow (see
 * tasks/spec-share-to-app.md). The network layer (authFetch) is stubbed; this pins
 * the endpoint/method/body shape the backend's VideoEssayFromYoutubeId expects.
 */
import { getOrCreateVideoEssayByYoutubeId } from '../videos';

// babel-jest hoists jest.mock above the imports; the factory only reads this lazily.
const mockAuthFetch = jest.fn();
jest.mock('../client', () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));

describe('getOrCreateVideoEssayByYoutubeId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POSTs the youtube_id to the from-youtube-id endpoint with the token', async () => {
    mockAuthFetch.mockResolvedValue({ public_id: 'abc-123', title: 'A Video' });
    await getOrCreateVideoEssayByYoutubeId('dQw4w9WgXcQ', 'tok');
    expect(mockAuthFetch).toHaveBeenCalledWith(
      '/VideoEssays/from-youtube-id/',
      { method: 'POST', body: JSON.stringify({ youtube_id: 'dQw4w9WgXcQ' }) },
      'tok'
    );
  });

  it('returns the VideoEssay response unchanged', async () => {
    const data = { public_id: 'abc-123', title: 'A Video', youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' };
    mockAuthFetch.mockResolvedValue(data);
    await expect(getOrCreateVideoEssayByYoutubeId('dQw4w9WgXcQ', 'tok')).resolves.toBe(data);
  });

  it('propagates a rejection (e.g. the backend 422 for an unresolvable id) rather than swallowing it', async () => {
    mockAuthFetch.mockRejectedValue(new Error('API error: 422 — {"error":"could not resolve youtube_id"}'));
    await expect(getOrCreateVideoEssayByYoutubeId('bad-id', 'tok')).rejects.toThrow('422');
  });
});
