const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidDomain(value) {
  return typeof value === 'string' && DOMAIN_REGEX.test(value.trim());
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

function isVerifiedStatus(value) {
  return ['verified', 'valid', 'deliverable', 'safe'].includes(String(value || '').toLowerCase());
}

module.exports = { isValidDomain, isValidEmail, isVerifiedStatus };
