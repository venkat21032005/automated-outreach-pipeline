const axios = require('axios');
const logger = require('../utils/logger');
const { isValidEmail } = require('../utils/validator');

class EazyreachService {
  constructor() {
    this.apiKey = process.env.EAZYREACH_API_KEY;
    // Fall back to Mock mode if explicit in env, if key is missing, or is the example placeholder
    this.isMock = process.env.MOCK_MODE === 'true' || !this.apiKey || this.apiKey === 'your_eazyreach_api_key_here';
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
