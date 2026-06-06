const { cleanLinkedinUrl } = require('../utils/normalize');

function dedupeContacts(contacts) {
  const seenLinkedin = new Set();
  const seenEmail = new Set();
  const seenIdentity = new Set();
  const unique = [];
  let duplicatesRemoved = 0;

  for (const contact of contacts) {
    const linkedin = cleanLinkedinUrl(contact.linkedinUrl);
    const email = String(contact.workEmail || '').trim().toLowerCase();
    const identity = `${String(contact.companyDomain || '').toLowerCase()}|${String(contact.fullName || '').trim().toLowerCase()}`;

    const duplicate = (linkedin && seenLinkedin.has(linkedin)) ||
      (email && seenEmail.has(email)) ||
      (identity !== '|' && seenIdentity.has(identity));

    if (duplicate) {
      duplicatesRemoved += 1;
      continue;
    }

    if (linkedin) seenLinkedin.add(linkedin);
    if (email) seenEmail.add(email);
    if (identity !== '|') seenIdentity.add(identity);
    unique.push(contact);
  }

  return { contacts: unique, duplicatesRemoved };
}

module.exports = { dedupeContacts };
