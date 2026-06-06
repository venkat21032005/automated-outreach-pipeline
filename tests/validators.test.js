const { isValidDomain, isValidEmail, isVerifiedStatus } = require('../src/utils/validators');

describe('validators', () => {
  test('validates bare company domains', () => {
    expect(isValidDomain('stripe.com')).toBe(true);
    expect(isValidDomain('https://stripe.com')).toBe(false);
  });

  test('validates emails and verified statuses', () => {
    expect(isValidEmail('person@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isVerifiedStatus('deliverable')).toBe(true);
    expect(isVerifiedStatus('risky')).toBe(false);
  });
});
