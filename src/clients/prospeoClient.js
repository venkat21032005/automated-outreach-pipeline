const axios = require('axios');
const { loadEnv, requireEnv } = require('../config/env');
const { withRetry } = require('../utils/retry');
const { normalizeContact } = require('../utils/normalize');

class ProspeoClient {
  constructor(config = loadEnv()) {
    this.config = config;
    this.http = axios.create({
      baseURL: config.prospeo.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { 'X-KEY': config.prospeo.apiKey, 'Content-Type': 'application/json' }
    });
  }

  async findDecisionMakers(domain) {
    requireEnv(this.config, [{ name: 'PROSPEO_API_KEY', value: this.config.prospeo.apiKey }]);
    const contacts = [];

    for (let page = 1; page <= this.config.prospeo.maxPages; page += 1) {
      const { sleep } = require('../utils/retry');
      await sleep(1100);

      const response = await withRetry(
        () => this.http.post(this.config.prospeo.searchPath, {
          filters: {
            person_search: domain,
            person_seniority: { include: ['C-Suite', 'Vice President'] }
          },
          page
        }),
        { ...this.config.retry, label: `Prospeo search for ${domain}` }
      );

      const payload = response.data?.response || response.data || {};
      const rawItems = payload.results || payload.data || [];
      const items = Array.isArray(rawItems) ? rawItems : [];
      contacts.push(...items.map((item) => normalizeProspeoResult(item, domain)).filter(isDecisionMaker));
      if (!hasNextPage(payload, items.length, this.config.prospeo.pageSize, page)) break;
    }

    return contacts;
  }
}

function normalizeProspeoResult(result, fallbackDomain) {
  const person = result.person || result;
  const company = result.company || person.company || {};
  return normalizeContact({
    ...person,
    companyName: company.name,
    companyDomain: company.website || company.domain || fallbackDomain
  }, fallbackDomain);
}

function isDecisionMaker(contact) {
  return Boolean(contact.linkedinUrl) &&
    /\b(chief|ceo|cfo|coo|cto|cmo|cio|founder|owner|president|vice president|vp)\b/i.test(contact.title);
}

function hasNextPage(data, itemCount, pageSize, page) {
  if (data.pagination?.has_next != null) return data.pagination.has_next;
  if (data.pagination?.total_page) return page < data.pagination.total_page;
  if (data.has_more != null) return data.has_more;
  return itemCount === pageSize;
}

module.exports = ProspeoClient;
