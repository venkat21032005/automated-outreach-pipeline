const oceanService = require('../src/services/ocean.service');
const prospeoService = require('../src/services/prospeo.service');
const eazyreachService = require('../src/services/eazyreach.service');
const brevoService = require('../src/services/brevo.service');

describe('Services Integration Tests (Mock Mode)', () => {
  beforeAll(() => {
    // Explicitly set mock mode for tests
    process.env.MOCK_MODE = 'true';
  });

  describe('Ocean.io Service', () => {
    test('should retrieve lookalikes for standard domains', async () => {
      const results = await oceanService.getSimilarCompanies('google.com');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toContain('microsoft.com');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should fallback gracefully for unknown domains', async () => {
      const results = await oceanService.getSimilarCompanies('randomcompany.xyz');
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toBe('competitor-a-randomcompany.xyz');
    });
  });

  describe('Prospeo Service', () => {
    test('should fetch contacts and filter for decision-makers only', async () => {
      const contacts = await prospeoService.getContacts('microsoft.com');
      expect(Array.isArray(contacts)).toBe(true);
      expect(contacts.length).toBeGreaterThan(0);

      // Verify each returned contact matches our decision-maker check
      contacts.forEach(contact => {
        expect(contact.name).toBeDefined();
        expect(contact.linkedin).toBeDefined();
        const isDecisionMaker = prospeoService.isDecisionMaker(contact.title);
        expect(isDecisionMaker).toBe(true);
      });
    });

    test('should filter out non-decision maker titles', () => {
      expect(prospeoService.isDecisionMaker('CEO')).toBe(true);
      expect(prospeoService.isDecisionMaker('Chief Technology Officer')).toBe(true);
      expect(prospeoService.isDecisionMaker('Software Engineer')).toBe(false);
      expect(prospeoService.isDecisionMaker('HR Generalist')).toBe(false);
    });
  });

  describe('Eazyreach Service', () => {
    test('should fetch emails for standard executives', async () => {
      const email = await eazyreachService.getEmailByLinkedin('https://linkedin.com/in/satyanadella', 'Satya Nadella', 'microsoft.com');
      expect(email).toBe('satya.nadella@microsoft.com');
    });

    test('should skip/fail on generic Jane Doe profiles to simulate invalid records', async () => {
      const email = await eazyreachService.getEmailByLinkedin('https://linkedin.com/in/jane-doe-test', 'Jane Doe', 'test.com');
      expect(email).toBeNull(); // Should fail as simulated unverified
    });
  });

  describe('Brevo Service', () => {
    test('should generate templates with placeholder replacements', () => {
      const { subject, textContent, htmlContent } = brevoService.generateTemplate('Satya Nadella', 'CEO', 'Microsoft');

      expect(subject).toContain('Microsoft');
      expect(textContent).toContain('Hi Satya');
      expect(textContent).toContain('CEO');
      expect(htmlContent).toContain('Microsoft');
      expect(htmlContent).toContain('CEO');
    });
  });
});
