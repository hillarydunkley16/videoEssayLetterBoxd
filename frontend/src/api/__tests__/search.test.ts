/**
 * Search API wrappers. The network layer (authFetch) is stubbed; these pin the URLs the backend
 * routes `users/search/` and `collections/search/` expect, and that q is URL-encoded.
 */
import { searchUsers } from '../users';
import { searchCollections } from '../collection';

// babel-jest hoists jest.mock above the imports; the factory only reads this lazily.
const mockAuthFetch = jest.fn();
jest.mock('../client', () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));

describe('search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
  });

  it('searchUsers requests the users search endpoint with q, page and the token', async () => {
    await searchUsers('film fan', 2, 'tok');
    expect(mockAuthFetch).toHaveBeenCalledWith('/users/search/?q=film%20fan&page=2', {}, 'tok');
  });

  it('searchCollections requests the collections search endpoint with q, page and the token', async () => {
    await searchCollections('essays', 1, 'tok');
    expect(mockAuthFetch).toHaveBeenCalledWith('/collections/search/?q=essays&page=1', {}, 'tok');
  });

  it('encodes characters that would otherwise change the query string', async () => {
    await searchUsers('a&b=c#d%', 1, 'tok');
    expect(mockAuthFetch).toHaveBeenCalledWith('/users/search/?q=a%26b%3Dc%23d%25&page=1', {}, 'tok');
    await searchCollections('a&b', 1, 'tok');
    expect(mockAuthFetch).toHaveBeenLastCalledWith('/collections/search/?q=a%26b&page=1', {}, 'tok');
  });

  it('returns the paginated response unchanged', async () => {
    const data = { count: 1, next: null, previous: null, results: [{ id: 7, username: 'ann', imageUrl: null, is_following: false }] };
    mockAuthFetch.mockResolvedValue(data);
    await expect(searchUsers('an', 1, 'tok')).resolves.toBe(data);
  });
});
