/**
 * checkUsernameAvailability — public (no token), so it uses plain axios against API_BASE_URL
 * rather than authFetch (mirrors fetchPopularVideoEssaysPublic in videos.ts).
 */
import axios from 'axios';
import { checkUsernameAvailability } from '../users';
import { API_BASE_URL } from '../client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('checkUsernameAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the username-available endpoint with the candidate query-encoded', async () => {
    mockedAxios.get.mockResolvedValue({ data: { available: true, suggestions: [] } } as any);
    await checkUsernameAvailability('jane doe');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API_BASE_URL}/users/username-available/?u=jane%20doe`
    );
  });

  it('encodes characters that would otherwise change the query string', async () => {
    mockedAxios.get.mockResolvedValue({ data: { available: true, suggestions: [] } } as any);
    await checkUsernameAvailability('a&b=c#d%');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      `${API_BASE_URL}/users/username-available/?u=a%26b%3Dc%23d%25`
    );
  });

  it('returns the available/suggestions response unchanged', async () => {
    const data = { available: false, suggestions: ['janedoe1', 'janedoe2', 'janedoe_'] };
    mockedAxios.get.mockResolvedValue({ data } as any);
    await expect(checkUsernameAvailability('janedoe')).resolves.toEqual(data);
  });
});
