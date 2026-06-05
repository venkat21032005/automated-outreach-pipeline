/**
 * Utility containing validation patterns for domains and emails.
 */

// Regex for validating domain names (supports subdomains and common TLDs)
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

// Standard RFC 5322 compliant regex for email validation (enforces TLD suffix)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates if a string is a valid company domain name.
 * 
 * @param {string} domain - Domain string.
 * @returns {boolean} True if valid.
 */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  return DOMAIN_REGEX.test(domain.trim());
}

/**
 * Validates if a string is a valid email address.
 * 
 * @param {string} email - Email string.
 * @returns {boolean} True if valid.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

module.exports = {
  isValidDomain,
  isValidEmail
};
