const axios = require('axios');
const logger = require('../utils/logger');

class OceanService {
  constructor() {
    this.apiKey = process.env.OCEAN_API_KEY;
    // Fall back to Mock mode if explicit in env, if key is missing, or is the example placeholder
    this.isMock = process.env.MOCK_MODE === 'true' || !this.apiKey || this.apiKey === 'your_ocean_api_key_here';
  }

  /**
   * Retrieves lookalike/similar companies for a given domain.
   * 
   * @param {string} domain - The target company domain.
   * @returns {Promise<string[]>} Array of lookalike company domains.
   */
  async getSimilarCompanies(domain) {
    const cleanDomain = domain.toLowerCase().trim();

    if (this.isMock) {
      logger.info(`[Ocean.io Mock] Finding similar companies for: ${cleanDomain}`);
      // Simulate API latency
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockLookalikes = {
        'google.com': ['microsoft.com', 'apple.com', 'meta.com', 'amazon.com'],
        'stripe.com': ['paypal.com', 'adyen.com', 'block.xyz', 'klarna.com'],
        'slack.com': ['zoom.us', 'microsoft.com', 'asana.com', 'monday.com']
      };

      const results = mockLookalikes[cleanDomain] || [
        `competitor-a-${cleanDomain}`,
        `competitor-b-${cleanDomain}`,
        `competitor-c-${cleanDomain}`
      ];
      
      logger.info(`[Ocean.io Mock] Found ${results.length} similar companies for ${cleanDomain}: ${results.join(', ')}`);
      return results;
    }

    logger.info(`[Ocean.io API] Querying lookalikes for: ${cleanDomain}`);
    try {
      // Ocean.io API post call to lookalike search endpoint
      const response = await axios.post(
        'https://api.ocean.io/v1/companies/lookalike',
        { domain: cleanDomain, limit: 10 },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Support common Ocean.io response structures: .companies or .data array
      if (response.data) {
        const companies = response.data.companies || response.data.data || [];
        if (Array.isArray(companies)) {
          const domains = companies.map(c => c.domain || c.company_domain).filter(Boolean);
          logger.info(`[Ocean.io API] Successfully retrieved ${domains.length} lookalike domains.`);
          return domains;
        }
      }
      
      logger.warn(`[Ocean.io API] Unexpected response format. Returning empty array.`, response.data);
      return [];
    } catch (error) {
      const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[Ocean.io API] Error occurred: ${errMsg}`);
      throw error;
    }
  }
}

module.exports = new OceanService();
