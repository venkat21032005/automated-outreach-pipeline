function composeEmail(contact) {
  const firstName = contact.firstName || contact.fullName?.split(/\s+/)[0] || 'there';
  const company = contact.companyName || contact.companyDomain;
  const title = contact.title || 'leadership role';
  const subject = `A quick idea for ${company}`;
  const textContent = `Hi ${firstName},

I noticed your work as ${title} at ${company}. We help teams automate the manual parts of targeted outbound while keeping outreach relevant and reviewable.

Would you be open to a brief conversation next week?

Best,
Outreach Team`;

  const htmlContent = `<p>Hi ${escapeHtml(firstName)},</p>
<p>I noticed your work as ${escapeHtml(title)} at ${escapeHtml(company)}. We help teams automate the manual parts of targeted outbound while keeping outreach relevant and reviewable.</p>
<p>Would you be open to a brief conversation next week?</p>
<p>Best,<br>Outreach Team</p>`;

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
