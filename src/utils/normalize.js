function cleanDomain(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function cleanLinkedinUrl(value = '') {
  return String(value).trim().replace(/\/+$/, '').toLowerCase();
}

function normalizeContact(raw = {}, fallbackDomain = '') {
  const firstName = raw.firstName || raw.first_name || raw.name?.first || '';
  const lastName = raw.lastName || raw.last_name || raw.name?.last || '';
  const fullName = raw.fullName || raw.full_name || raw.name?.full ||
    (typeof raw.name === 'string' ? raw.name : `${firstName} ${lastName}`.trim());

  // Handle case where raw.email is an object (Prospeo search-person API) vs string
  const emailObj = raw.email && typeof raw.email === 'object' ? raw.email : null;
  const emailStr = emailObj ? emailObj.email : (raw.workEmail || raw.work_email || raw.email || '');
  const statusStr = emailObj ? emailObj.status : (raw.emailStatus || raw.email_status || raw.status || '');

  return {
    fullName: fullName || '',
    firstName: firstName || String(fullName || '').split(/\s+/)[0] || '',
    title: raw.title || raw.current_job_title || raw.job_title || raw.headline || '',
    companyName: raw.companyName || raw.company_name || raw.company?.name || '',
    companyDomain: cleanDomain(raw.companyDomain || raw.company_domain || raw.company?.domain || fallbackDomain),
    linkedinUrl: cleanLinkedinUrl(raw.linkedinUrl || raw.linkedin_url || raw.linkedin || ''),
    workEmail: typeof emailStr === 'string' ? emailStr.trim().toLowerCase() : '',
    emailStatus: typeof statusStr === 'string' ? statusStr.trim().toLowerCase() : ''
  };
}

module.exports = { cleanDomain, cleanLinkedinUrl, normalizeContact };
