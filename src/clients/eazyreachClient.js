const axios = require('axios');
const { loadEnv, isConfigured } = require('../config/env');
const { withRetry } = require('../utils/retry');
const { isValidEmail } = require('../utils/validators');
const logger = require('../utils/logger');

class EazyreachClient {
  constructor(config = loadEnv()) {
    this.config = config;
    this.http = axios.create({
      baseURL: 'https://api.prospeo.io',
      timeout: config.requestTimeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async enrichByLinkedin(contact) {
    logger.info(`[Eazyreach] EazyReach does not provide an official developer REST API. Resolving LinkedIn URL via Prospeo Enrich Person API...`);

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
      () => this.http.post(
        '/enrich-person',
        {
          only_verified_email: true,
          enrich_mobile: false,
          data: {
            linkedin_url: contact.linkedinUrl
          }
        },
        {
          headers: {
            'X-KEY': prospeoApiKey
          }
        }
      ),
      { ...this.config.retry, label: `Prospeo enrichment fallback for ${contact.linkedinUrl}` }
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
}

module.exports = EazyreachClient;
