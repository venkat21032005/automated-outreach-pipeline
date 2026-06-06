const axios = require('axios');
const logger = require('../utils/logger');

class ProspeoService {
  constructor() {
    this.apiKey = process.env.PROSPEO_API_KEY;
    // Fall back to Mock mode if explicit in env, if key is missing, or is the example placeholder
    this.isMock = process.env.MOCK_MODE === 'true' || !this.apiKey || this.apiKey === 'your_prospeo_api_key_here';
  }

  /**
   * Retrieves decision-makers for a given domain.
   * Filters by positions: CEO, CTO, Founder, VP, Head.
   * 
   * @param {string} domain - The target company domain.
   * @returns {Promise<Object[]>} Array of contact objects: { name, title, companyName, companyDomain, linkedin }
   */
  async getContacts(domain) {
    const cleanDomain = domain.toLowerCase().trim();

    if (this.isMock) {
      logger.info(`[Prospeo Mock] Fetching contacts for: ${cleanDomain}`);
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockData = {
        'microsoft.com': [
          { name: 'Satya Nadella', title: 'Chief Executive Officer (CEO)', companyName: 'Microsoft', companyDomain: 'microsoft.com', linkedin: 'https://linkedin.com/in/satyanadella' },
          { name: 'Kevin Scott', title: 'Chief Technology Officer (CTO)', companyName: 'Microsoft', companyDomain: 'microsoft.com', linkedin: 'https://linkedin.com/in/kevinscott' },
          { name: 'Brad Smith', title: 'President & Vice Chair', companyName: 'Microsoft', companyDomain: 'microsoft.com', linkedin: 'https://linkedin.com/in/bradsmit' }
        ],
        'apple.com': [
          { name: 'Tim Cook', title: 'CEO', companyName: 'Apple', companyDomain: 'apple.com', linkedin: 'https://linkedin.com/in/timcook' },
          { name: 'Craig Federighi', title: 'Senior VP, Software Engineering', companyName: 'Apple', companyDomain: 'apple.com', linkedin: 'https://linkedin.com/in/craigfederighi' }
        ],
        'meta.com': [
          { name: 'Mark Zuckerberg', title: 'Founder & CEO', companyName: 'Meta', companyDomain: 'meta.com', linkedin: 'https://linkedin.com/in/zuck' },
          { name: 'Andrew Bosworth', title: 'CTO', companyName: 'Meta', companyDomain: 'meta.com', linkedin: 'https://linkedin.com/in/boz' }
        ],
        'amazon.com': [
          { name: 'Andy Jassy', title: 'CEO', companyName: 'Amazon', companyDomain: 'amazon.com', linkedin: 'https://linkedin.com/in/andyjassy' },
          { name: 'Werner Vogels', title: 'VP & CTO', companyName: 'Amazon', companyDomain: 'amazon.com', linkedin: 'https://linkedin.com/in/wernervogels' }
        ],
        'paypal.com': [
          { name: 'Alex Chriss', title: 'President & CEO', companyName: 'PayPal', companyDomain: 'paypal.com', linkedin: 'https://linkedin.com/in/alexchriss' }
        ]
      };

      const rawContacts = mockData[cleanDomain] || [
        { name: `Jane Doe`, title: 'CEO & Founder', companyName: cleanDomain.split('.')[0].toUpperCase(), companyDomain: cleanDomain, linkedin: `https://linkedin.com/in/jane-doe-${cleanDomain.split('.')[0]}` },
        { name: `John Smith`, title: 'VP of Engineering', companyName: cleanDomain.split('.')[0].toUpperCase(), companyDomain: cleanDomain, linkedin: `https://linkedin.com/in/john-smith-${cleanDomain.split('.')[0]}` }
      ];

      // Filter based on roles: CEO, CTO, Founder, VP, Head
      const filtered = rawContacts.filter(c => this.isDecisionMaker(c.title));
      logger.info(`[Prospeo Mock] Found ${filtered.length} decision-makers for ${cleanDomain}.`);
      return filtered;
    }

    logger.info(`[Prospeo API] Querying contacts for: ${cleanDomain}`);
    try {
      // Prospeo Search Person Endpoint (Latest API spec)
      const response = await axios.post(
        'https://api.prospeo.io/search-person',
        {
          filters: {
            person_search: {
              company_domain: cleanDomain
            }
          },
          page: 1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-KEY': this.apiKey
          },
          timeout: 10000
        }
      );

      // Prospeo API returns structured contacts under response.data.results or response.data.response.results
      const results = response.data && response.data.response ? response.data.response.results : (response.data ? response.data.results : []);
      if (!Array.isArray(results)) {
        logger.warn(`[Prospeo API] Response did not contain lists of results.`, response.data);
        return [];
      }

      const formattedContacts = results.map(contact => {
        // Support both latest search-person properties and legacy/mock formats
        const name = contact.full_name || 
                     (contact.first_name || contact.last_name 
                       ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() 
                       : (contact.name && typeof contact.name === 'object' ? `${contact.name.first || ''} ${contact.name.last || ''}`.trim() : 'Unknown'));
        
        const title = contact.current_job_title || contact.headline || contact.title || '';
        const linkedin = contact.linkedin_url || contact.linkedin || '';
        const companyName = contact.company && contact.company.name ? contact.company.name : cleanDomain.split('.')[0].toUpperCase();
        
        return {
          name,
          title,
          companyName,
          companyDomain: cleanDomain,
          linkedin
        };
      });

      // Filter decision makers
      const filtered = formattedContacts.filter(c => this.isDecisionMaker(c.title));
      logger.info(`[Prospeo API] Found ${filtered.length} matching decision-makers for ${cleanDomain}.`);
      return filtered;
    } catch (error) {
      const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[Prospeo API] Error occurred: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Helper to check if a title represents a target decision maker (CEO, CTO, Founder, VP, Head).
   * 
   * @param {string} title - Job title.
   * @returns {boolean}
   */
  isDecisionMaker(title) {
    if (!title) return false;
    const lowerTitle = title.toLowerCase();
    
    // Matches the required terms case-insensitively
    const targets = [
      'ceo', 'cto', 'founder', 'vp', 'vice president', 'head of', 
      'chief technology officer', 'chief executive officer', 'president'
    ];
    return targets.some(target => lowerTitle.includes(target));
  }
}

module.exports = new ProspeoService();
