import { validationMessage } from '../validationMessage';

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
