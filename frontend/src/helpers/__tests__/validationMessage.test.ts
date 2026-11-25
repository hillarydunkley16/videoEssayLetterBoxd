import { validationErrors, validationMessage } from '../validationMessage';

const badRequest = (data: unknown) => ({ response: { status: 400, data } });

describe('validationMessage', () => {
  it('turns a DRF field error into "Label: message"', () => {
    expect(validationMessage(badRequest({ review_text: ['This field may not be blank.'] })))
      .toBe('Review: This field may not be blank.');
  });

  it('uses the raw field name for fields it has no label for', () => {
    expect(validationMessage(badRequest({ essay: ['Invalid.'] }))).toBe('essay: Invalid.');
  });

  it('returns null for anything that is not a 400 validation payload', () => {
    expect(validationMessage(new Error('network'))).toBeNull();
    expect(validationMessage({ response: { status: 500, data: {} } })).toBeNull();
    expect(validationMessage(badRequest('<html>oops</html>'))).toBeNull();
    expect(validationMessage(badRequest({}))).toBeNull();
  });
});

describe('validationErrors', () => {
  it('returns the first message per field, unlabelled', () => {
    expect(validationErrors(badRequest({ review_text: ['This field may not be blank.'], rating: ['Too high.', 'x'] })))
      .toEqual({ review_text: 'This field may not be blank.', rating: 'Too high.' });
  });

  it('returns null when the error is not a 400 validation payload', () => {
    expect(validationErrors(new Error('network'))).toBeNull();
    expect(validationErrors(badRequest({}))).toBeNull();
  });
});

describe('validationMessage with skipped fields', () => {
  it('ignores fields shown elsewhere and reports the next one', () => {
    const err = badRequest({ review_text: ['Blank.'], rating: ['Too high.'] });
    expect(validationMessage(err, ['review_text'])).toBe('Rating: Too high.');
  });

  it('returns null when only skipped fields failed', () => {
    expect(validationMessage(badRequest({ review_text: ['Blank.'] }), ['review_text'])).toBeNull();
  });
});
