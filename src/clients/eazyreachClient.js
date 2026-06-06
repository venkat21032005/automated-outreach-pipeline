const axios = require('axios');
const { loadEnv, requireEnv, isConfigured } = require('../config/env');
const { withRetry } = require('../utils/retry');
const { isValidEmail, isVerifiedStatus } = require('../utils/validators');

class EazyreachClient {
  constructor(config = loadEnv()) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.eazyreach.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async enrichByLinkedin(contact) {
    const hasEazyreachToken = isConfigured(this.config.eazyreach.authToken);
    const hasEazyreachClientCredentials =
      isConfigured(this.config.eazyreach.clientId) && isConfigured(this.config.eazyreach.clientSecret);

    if (!hasEazyreachToken && !hasEazyreachClientCredentials) {
      const logger = require('../utils/logger');
      logger.info(`[Eazyreach Fallback] Eazyreach credentials not configured. Using Prospeo Enrich Person API for Stage 3...`);

      const prospeoApiKey = this.config.prospeo.apiKey;
      if (!isConfigured(prospeoApiKey)) {
        logger.warn(`[Eazyreach Fallback] Prospeo API Key not found. Skipping enrichment.`);
        return {
          ...contact,
          workEmail: '',
          emailStatus: 'unverified'
        };
      }

      const { sleep } = require('../utils/retry');
      await sleep(250);

      const response = await withRetry(
        () => axios.post(
          'https://api.prospeo.io/enrich-person',
          {
            only_verified_email: true,
            enrich_mobile: false,
            data: {
              linkedin_url: contact.linkedinUrl
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-KEY': prospeoApiKey
            },
            timeout: this.config.requestTimeoutMs
          }
        ),
        { ...this.config.retry, label: `Prospeo fallback enrichment for ${contact.linkedinUrl}` }
      );

      const person = response.data?.person || {};
      const workEmail = String(person.email || '').trim().toLowerCase();
      const emailStatus = String(person.email_status || '').trim().toLowerCase();

      return {
        ...contact,
        workEmail: isValidEmail(workEmail) ? workEmail : '',
        emailStatus: emailStatus === 'verified' || emailStatus === 'deliverable' ? 'verified' : 'unverified'
      };
    }

    const authToken = await this.getAuthToken();

    const response = await withRetry(
      () => this.http.post(
        this.config.eazyreach.enrichPath,
        { linkedinUrl: contact.linkedinUrl },
        { headers: { Authorization: `Bearer ${authToken}` } }
      ),
      { ...this.config.retry, label: `Eazyreach enrichment for ${contact.linkedinUrl}` }
    );

    const emails = Array.isArray(response.data?.emails) ? response.data.emails : [];
    const bestEmail = emails.find((item) => isVerifiedStatus(item.verification)) || emails[0] || {};
    const workEmail = String(bestEmail.email || '').trim().toLowerCase();
    const emailStatus = String(bestEmail.verification || '').trim().toLowerCase();

    return {
      ...contact,
      workEmail: isValidEmail(workEmail) ? workEmail : '',
      emailStatus: isVerifiedStatus(emailStatus) ? 'verified' : emailStatus || 'unknown'
    };
  }

  async getAuthToken() {
    if (isConfigured(this.config.eazyreach.authToken)) return this.config.eazyreach.authToken;

    requireEnv(this.config, [
      { name: 'EAZYREACH_CLIENT_ID', value: this.config.eazyreach.clientId },
      { name: 'EAZYREACH_CLIENT_SECRET', value: this.config.eazyreach.clientSecret }
    ]);

    const response = await withRetry(
      () => this.http.post(this.config.eazyreach.authPath, {
        clientId: this.config.eazyreach.clientId,
        clientSecret: this.config.eazyreach.clientSecret
      }),
      { ...this.config.retry, label: 'Eazyreach authentication' }
    );

    const token = response.data?.auth_token;
    if (!token) throw new Error('Eazyreach authentication response did not include auth_token');
    this.config.eazyreach.authToken = token;
    return token;
  }
}

module.exports = EazyreachClient;
