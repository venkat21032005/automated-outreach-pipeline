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

  return {
    fullName: fullName || '',
    firstName: firstName || String(fullName || '').split(/\s+/)[0] || '',
    title: raw.title || raw.current_job_title || raw.job_title || raw.headline || '',
    companyName: raw.companyName || raw.company_name || raw.company?.name || '',
    companyDomain: cleanDomain(raw.companyDomain || raw.company_domain || raw.company?.domain || fallbackDomain),
    linkedinUrl: cleanLinkedinUrl(raw.linkedinUrl || raw.linkedin_url || raw.linkedin || ''),
    workEmail: String(raw.workEmail || raw.work_email || raw.email || '').trim().toLowerCase(),
    emailStatus: String(raw.emailStatus || raw.email_status || raw.status || '').trim().toLowerCase()
  };
}

module.exports = { cleanDomain, cleanLinkedinUrl, normalizeContact };
