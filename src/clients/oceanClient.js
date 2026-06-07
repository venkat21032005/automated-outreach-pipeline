const axios = require('axios');
const { loadEnv, requireEnv } = require('../config/env');
const { withRetry } = require('../utils/retry');
const { cleanDomain } = require('../utils/normalize');

class OceanClient {
  constructor(config = loadEnv()) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.ocean.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { 'X-Api-Token': config.ocean.apiKey, 'Content-Type': 'application/json' }
    });
  }

  async findSimilarDomains(seedDomain) {
    requireEnv(this.config, [{ name: 'OCEAN_API_KEY', value: this.config.ocean.apiKey }]);
    const domains = [];
    let searchAfter;

    for (let page = 1; page <= this.config.ocean.maxPages; page += 1) {
      const response = await withRetry(
        () => this.http.post(this.config.ocean.lookalikePath, {
          size: this.config.ocean.pageSize,
          companiesFilters: {
            lookalikeDomains: [cleanDomain(seedDomain)],
            excludeDomains: [cleanDomain(seedDomain)]
          },
          fields: ['domain', 'name'],
          ...(searchAfter ? { searchAfter } : {})
        }),
        { ...this.config.retry, label: 'Ocean.io lookalike search' }
      );

      const rawItems = response.data?.companies || response.data?.data?.companies ||
        response.data?.data || response.data?.results || [];
      const items = Array.isArray(rawItems) ? rawItems : [];
      domains.push(...items.map((item) =>
        cleanDomain(item.company?.domain || item.domain || item.company_domain)
      ).filter(Boolean));
      searchAfter = response.data?.searchAfter || response.data?.search_after ||
        response.data?.pagination?.searchAfter;
      if (!searchAfter || items.length === 0) break;
    }

    return [...new Set(domains)].filter((domain) => domain !== cleanDomain(seedDomain));
  }
}

module.exports = OceanClient;
