function composeEmail(contact, senderName) {
  const firstName = contact.firstName || contact.fullName?.split(/\s+/)[0] || 'there';
  const company = contact.companyName || contact.companyDomain;
  const title = contact.title || 'leadership role';
  const signature = senderName || 'Outreach Team';
  const subject = `outbound workflow at ${company}`;
  const textContent = `Hi ${firstName},

I saw you lead the team as ${title} at ${company}. 

We help outbound teams automate lead sourcing and verified email resolution (similar to how we built this pipeline) without losing personalization or running into rate limits.

I put together a brief outline of how this reduces prospecting time by 80%. Worth a quick look?

Best,
${signature}`;

  const htmlContent = `<p>Hi ${escapeHtml(firstName)},</p>
<p>I saw you lead the team as ${escapeHtml(title)} at ${escapeHtml(company)}.</p>
<p>We help outbound teams automate lead sourcing and verified email resolution (similar to how we built this pipeline) without losing personalization or running into rate limits.</p>
<p>I put together a brief outline of how this reduces prospecting time by 80%. Worth a quick look?</p>
<p>Best,<br>${escapeHtml(signature)}</p>`;

  return { subject, textContent, htmlContent };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

module.exports = { composeEmail };
