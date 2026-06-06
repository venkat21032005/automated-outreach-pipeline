const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (!loaded) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    loaded = true;
  }

  return {
    ocean: {
      apiKey: process.env.OCEAN_API_KEY,
      baseUrl: process.env.OCEAN_BASE_URL || 'https://api.ocean.io',
      lookalikePath: process.env.OCEAN_LOOKALIKE_PATH || '/v3/search/companies',
      pageSize: positiveInt(process.env.OCEAN_PAGE_SIZE, 50),
      maxPages: positiveInt(process.env.OCEAN_MAX_PAGES, 5)
    },
    prospeo: {
      apiKey: process.env.PROSPEO_API_KEY,
      baseUrl: process.env.PROSPEO_BASE_URL || 'https://api.prospeo.io',
      searchPath: process.env.PROSPEO_SEARCH_PATH || '/search-person',
      pageSize: positiveInt(process.env.PROSPEO_PAGE_SIZE, 25),
      maxPages: positiveInt(process.env.PROSPEO_MAX_PAGES, 5)
    },
    eazyreach: {
      authToken: process.env.EAZYREACH_AUTH_TOKEN || process.env.EAZYREACH_API_KEY,
      clientId: process.env.EAZYREACH_CLIENT_ID,
      clientSecret: process.env.EAZYREACH_CLIENT_SECRET,
      baseUrl: process.env.EAZYREACH_BASE_URL || 'https://api.superflow.run',
      authPath: process.env.EAZYREACH_AUTH_PATH || '/b2b/createAuthToken/',
      enrichPath: process.env.EAZYREACH_ENRICH_PATH || '/b2b/linkedin-emails'
    },
    brevo: {
      apiKey: process.env.BREVO_API_KEY,
      baseUrl: process.env.BREVO_BASE_URL || 'https://api.brevo.com/v3',
      senderEmail: process.env.BREVO_SENDER_EMAIL,
      senderName: process.env.BREVO_SENDER_NAME || 'Outreach Team'
    },
    requestTimeoutMs: positiveInt(process.env.REQUEST_TIMEOUT_MS, 20000),
    concurrency: positiveInt(process.env.PIPELINE_CONCURRENCY, 1),
    retry: {
      retries: positiveInt(process.env.RETRY_ATTEMPTS, 3),
      baseDelayMs: positiveInt(process.env.RETRY_BASE_DELAY_MS, 1000)
    }
  };
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requireEnv(config, requirements) {
  const missing = requirements.filter(({ value }) => !isConfigured(value)).map(({ name }) => name);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function isConfigured(value) {
  return Boolean(value) && !/^(your_|replace_|example|placeholder)/i.test(String(value).trim());
}

function validatePipelineEnv(config) {
  requireEnv(config, [
    { name: 'OCEAN_API_KEY', value: config.ocean.apiKey },
    { name: 'PROSPEO_API_KEY', value: config.prospeo.apiKey },
    { name: 'BREVO_API_KEY', value: config.brevo.apiKey },
    { name: 'BREVO_SENDER_EMAIL', value: config.brevo.senderEmail }
  ]);
}

module.exports = { loadEnv, requireEnv, isConfigured, validatePipelineEnv };
