const axios = require('axios');
const logger = require('../utils/logger');
const { isValidEmail } = require('../utils/validator');

class EazyreachService {
  constructor() {
    this.apiKey = process.env.EAZYREACH_API_KEY;
    this.sessionToken = process.env.EAZYREACH_SESSION_TOKEN;
    
    // Determine mode: Mock, Session-JWT (GraphQL), or REST API
    this.isSessionMode = !!this.sessionToken && this.sessionToken !== 'your_session_token_here';
    this.isMock = (process.env.MOCK_MODE === 'true' || (!this.apiKey && !this.isSessionMode)) || 
                  (this.apiKey === 'your_eazyreach_api_key_here' && !this.isSessionMode);
  }

  /**
   * Retrieves a verified email for a given LinkedIn URL.
   * 
   * @param {string} linkedinUrl - LinkedIn profile URL.
   * @param {string} name - Contact's full name.
   * @param {string} companyDomain - Company domain.
   * @returns {Promise<string|null>} Verified work email, or null if not found/invalid.
   */
  async getEmailByLinkedin(linkedinUrl, name, companyDomain) {
    if (!linkedinUrl) {
      logger.warn(`[Eazyreach] Missing LinkedIn URL for ${name}. Skipping.`);
      return null;
    }

    // --- 1. MOCK MODE ---
    if (this.isMock) {
      logger.info(`[Eazyreach Mock] Finding email for LinkedIn URL: ${linkedinUrl}`);
      // Simulate API latency
      await new Promise(resolve => setTimeout(resolve, 600));

      // Preset realistic emails for our mock executives
      const urlToEmail = {
        'https://linkedin.com/in/satyanadella': 'satya.nadella@microsoft.com',
        'https://linkedin.com/in/kevinscott': 'kevin.scott@microsoft.com',
        'https://linkedin.com/in/timcook': 'tcook@apple.com',
        'https://linkedin.com/in/craigfederighi': 'craig.federighi@apple.com',
        'https://linkedin.com/in/zuck': 'zuck@meta.com',
        'https://linkedin.com/in/boz': 'boz@meta.com',
        'https://linkedin.com/in/andyjassy': 'jassy@amazon.com',
        'https://linkedin.com/in/wernervogels': 'werner.vogels@amazon.com',
        'https://linkedin.com/in/alexchriss': 'alex.chriss@paypal.com'
      };

      let email = urlToEmail[linkedinUrl];

      if (!email) {
        // Generate email dynamically based on name and domain
        const nameParts = name.toLowerCase().split(' ');
        if (nameParts.length >= 2) {
          email = `${nameParts[0]}.${nameParts[1]}@${companyDomain}`;
        } else {
          email = `${nameParts[0]}@${companyDomain}`;
        }
      }

      // Randomly simulate invalid/skipped record for mock entries to demonstrate filtering of unverified records
      const shouldFail = name.toLowerCase().includes('doe') || Math.random() < 0.15;
      if (shouldFail) {
        logger.warn(`[Eazyreach Mock] No verified email found for LinkedIn profile: ${linkedinUrl}`);
        return null;
      }

      if (isValidEmail(email)) {
        logger.info(`[Eazyreach Mock] Found verified email: ${email}`);
        return email;
      }
      logger.warn(`[Eazyreach Mock] Generated email was invalid: ${email}`);
      return null;
    }

    // --- 2. ADVANCED SESSION JWT MODE (GraphQL Reverse-Engineered) ---
    if (this.isSessionMode) {
      logger.info(`[Eazyreach GraphQL] Enriching profile via session token...`);
      try {
        // Since Eazyreach uses a Hasura GraphQL Backend, we perform a POST to their GraphQL router.
        // We use the custom query variable from env or default to standard structure.
        const query = process.env.EAZYREACH_GRAPHQL_QUERY || `
          mutation EnrichProfile($linkedinUrl: String!) {
            enrich(linkedin_url: $linkedinUrl) {
              email
              status
            }
          }
        `;

        const response = await axios.post(
          'https://db.subspace.money/v1/graphql',
          {
            query,
            variables: { linkedinUrl }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.sessionToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 12000
          }
        );

        // Parse standard GraphQL response format
        const data = response.data && response.data.data ? (response.data.data.enrich || response.data.data) : null;
        if (data && data.email) {
          if (isValidEmail(data.email)) {
            logger.info(`[Eazyreach GraphQL] Found verified email: ${data.email}`);
            return data.email;
          }
        }

        logger.warn(`[Eazyreach GraphQL] No verified email resolved in GraphQL response: ${JSON.stringify(response.data)}`);
        return null;
      } catch (error) {
        const errMsg = error.response ? `GraphQL HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        logger.error(`[Eazyreach GraphQL] Connection failed: ${errMsg}`);
        throw error;
      }
    }

    // --- 3. STANDARD REST API MODE (Fallback if public API keys are released) ---
    logger.info(`[Eazyreach API] Querying email for LinkedIn: ${linkedinUrl}`);
    try {
      const response = await axios.post(
        'https://api.eazyreach.com/v1/linkedin-to-email',
        { linkedin_url: linkedinUrl },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Extract details from standard Eazyreach API structure
      const email = response.data && response.data.email ? response.data.email : (response.data && response.data.data ? response.data.data.email : null);
      const status = response.data && response.data.status ? response.data.status : (response.data && response.data.data ? response.data.data.status : 'unverified');

      if (email && (status === 'verified' || status === 'deliverable')) {
        if (isValidEmail(email)) {
          logger.info(`[Eazyreach API] Found verified email: ${email}`);
          return email;
        }
      }

      logger.warn(`[Eazyreach API] Email not found or not verified for LinkedIn: ${linkedinUrl}`);
      return null;
    } catch (error) {
      const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[Eazyreach API] Error occurred: ${errMsg}`);
      throw error;
    }
  }
}

module.exports = new EazyreachService();
