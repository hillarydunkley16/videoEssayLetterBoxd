/**
 * The search screen's `type` route param. Anything that isn't a known mode falls back to
 * essays, so a stale, hand-edited or repeated (`?type=a&type=b`) param can never blank the screen.
 */
import { parseSearchType, SEARCH_PLACEHOLDER } from '../searchModes';

describe('parseSearchType', () => {
  it('defaults to essays', () => {
    expect(parseSearchType(undefined)).toBe('essays');
    expect(parseSearchType('')).toBe('essays');
  });

  it('accepts the known modes', () => {
    expect(parseSearchType('essays')).toBe('essays');
    expect(parseSearchType('people')).toBe('people');
  });

  it('falls back to essays for anything else', () => {
    expect(parseSearchType('lists')).toBe('essays'); // until the Lists view exists
    expect(parseSearchType('PEOPLE')).toBe('essays');
    expect(parseSearchType('nonsense')).toBe('essays');
    expect(parseSearchType(['people', 'essays'])).toBe('essays');
  });

  it('has a placeholder for every mode', () => {
    expect(SEARCH_PLACEHOLDER.essays).toBe('Search a video essay…');
    expect(SEARCH_PLACEHOLDER.people).toBe('Search people…');
  });
});
