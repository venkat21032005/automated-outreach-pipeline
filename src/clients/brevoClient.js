const axios = require('axios');
const { loadEnv, requireEnv } = require('../config/env');
const { withRetry } = require('../utils/retry');

class BrevoClient {
  constructor(config = loadEnv()) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.brevo.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { 'api-key': config.brevo.apiKey, 'Content-Type': 'application/json' }
    });
  }

  async send(contact, message) {
    requireEnv(this.config, [
      { name: 'BREVO_API_KEY', value: this.config.brevo.apiKey },
      { name: 'BREVO_SENDER_EMAIL', value: this.config.brevo.senderEmail }
    ]);

    const response = await withRetry(
      () => this.http.post('/smtp/email', {
        sender: { name: this.config.brevo.senderName, email: this.config.brevo.senderEmail },
        to: [{ name: contact.fullName, email: contact.workEmail }],
        subject: message.subject,
        textContent: message.textContent,
        htmlContent: message.htmlContent
      }),
      { ...this.config.retry, label: `Brevo send to ${contact.workEmail}` }
    );

    return { ...contact, messageId: response.data?.messageId || '', sentAt: new Date().toISOString() };
  }
}

module.exports = BrevoClient;
