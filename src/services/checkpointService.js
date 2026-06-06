const readline = require('readline');

function printSummary(summary, recipients) {
  console.log('\nSafety checkpoint');
  console.table({
    'Domains found': summary.domainsFound,
    'Contacts found': summary.contactsFound,
    'Verified emails found': summary.verifiedEmailsFound,
    'Duplicates removed': summary.duplicatesRemoved,
    'Final recipients': summary.finalRecipients
  });

  if (recipients.length) {
    console.table(recipients.map((contact) => ({
      name: contact.fullName,
      title: contact.title,
      company: contact.companyName || contact.companyDomain,
      email: contact.workEmail
    })));
  }
}

function confirmSend() {
  if (!process.stdin.isTTY) return Promise.resolve(false);

  return new Promise((resolve) => {
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    prompt.question('Send these emails through Brevo? Type yes to continue: ', (answer) => {
      prompt.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

module.exports = { printSummary, confirmSend };
