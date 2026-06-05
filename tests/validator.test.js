const { isValidDomain, isValidEmail } = require('../src/utils/validator');

describe('Validator Utility Tests', () => {
  describe('isValidDomain', () => {
    test('should return true for valid domains', () => {
      expect(isValidDomain('google.com')).toBe(true);
      expect(isValidDomain('stripe.com')).toBe(true);
      expect(isValidDomain('sub.domain.co.uk')).toBe(true);
      expect(isValidDomain('my-domain.org')).toBe(true);
    });

    test('should return false for invalid domains', () => {
      expect(isValidDomain('google')).toBe(false);
      expect(isValidDomain('http://google.com')).toBe(false);
      expect(isValidDomain('google.com/path')).toBe(false);
      expect(isValidDomain('@google.com')).toBe(false);
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain(null)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('first.last@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+spam@gmail.com')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@example')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });
});
