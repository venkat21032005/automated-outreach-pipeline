const { dedupeContacts } = require('../src/services/dedupeService');

test('deduplicates in LinkedIn, email, then identity order', () => {
  const base = {
    fullName: 'Ada Lovelace',
    companyDomain: 'example.com',
    linkedinUrl: 'https://linkedin.com/in/ada',
    workEmail: 'ada@example.com'
  };
  const result = dedupeContacts([
    base,
    { ...base, workEmail: 'different@example.com' },
    { ...base, linkedinUrl: 'https://linkedin.com/in/different' }
  ]);

  expect(result.contacts).toHaveLength(1);
  expect(result.duplicatesRemoved).toBe(2);
});
