const OceanClient = require('../src/clients/oceanClient');
const ProspeoClient = require('../src/clients/prospeoClient');
const EazyreachClient = require('../src/clients/eazyreachClient');

function config() {
  return {
    ocean: {
      apiKey: 'valid-ocean-key',
      baseUrl: 'https://api.ocean.test',
      lookalikePath: '/v3/search/companies',
      pageSize: 5,
      maxPages: 1
    },
    prospeo: {
      apiKey: 'valid-prospeo-key',
      baseUrl: 'https://api.prospeo.test',
      searchPath: '/search-person',
      pageSize: 25,
      maxPages: 1
    },
    requestTimeoutMs: 1000,
    retry: { retries: 0, baseDelayMs: 1 }
  };
}

test('Ocean uses lookalikeDomains and reads nested company domains', async () => {
  const client = new OceanClient(config());
  client.http.post = jest.fn().mockResolvedValue({
    data: { companies: [{ company: { domain: 'similar.example' } }] }
  });

  await expect(client.findSimilarDomains('seed.example')).resolves.toEqual(['similar.example']);
  expect(client.http.post.mock.calls[0][1].companiesFilters.lookalikeDomains).toEqual(['seed.example']);
});

test('Prospeo normalizes person and company result objects', async () => {
  const client = new ProspeoClient(config());
  client.http.post = jest.fn().mockResolvedValue({
    data: {
      results: [{
        person: {
          full_name: 'Ada Lovelace',
          current_job_title: 'Vice President of Engineering',
          linkedin_url: 'https://linkedin.com/in/ada'
        },
        company: { name: 'Example', website: 'example.com' }
      }],
      pagination: { current_page: 1, total_page: 1 }
    }
  });

  const contacts = await client.findDecisionMakers('example.com');
  expect(contacts[0]).toMatchObject({
    fullName: 'Ada Lovelace',
    companyName: 'Example',
    companyDomain: 'example.com'
  });
});

test('Eazyreach submits a LinkedIn URL and accepts only verified email status', async () => {
  const client = new EazyreachClient(config());
  client.http.post = jest.fn().mockResolvedValue({
    data: { person: { email: 'ada@example.com', email_status: 'verified' } }
  });

  const enriched = await client.enrichByLinkedin({ linkedinUrl: 'https://linkedin.com/in/ada' });
  expect(client.http.post.mock.calls[0][1].data.linkedin_url).toEqual('https://linkedin.com/in/ada');
  expect(enriched).toMatchObject({ workEmail: 'ada@example.com', emailStatus: 'verified' });
});

describe('Ocean.io Pagination and OCEAN_MAX_PAGES', () => {
  test('Ocean performs searchAfter cursor pagination up to maxPages', async () => {
    const customConfig = config();
    customConfig.ocean.maxPages = 2;
    const client = new OceanClient(customConfig);

    client.http.post = jest.fn()
      .mockResolvedValueOnce({
        data: {
          companies: [{ domain: 'page1.com' }],
          searchAfter: 'cursor-token-123'
        }
      })
      .mockResolvedValueOnce({
        data: {
          companies: [{ domain: 'page2.com' }]
        }
      });

    const domains = await client.findSimilarDomains('seed.com');
    expect(domains).toEqual(['page1.com', 'page2.com']);
    expect(client.http.post).toHaveBeenCalledTimes(2);
    // Verify that the second call passed the searchAfter cursor parameter
    expect(client.http.post.mock.calls[1][0]).toEqual('/v3/search/companies');
    expect(client.http.post.mock.calls[1][1]).toMatchObject({
      searchAfter: 'cursor-token-123'
    });
  });

  test('Ocean respects OCEAN_MAX_PAGES limit and stops early', async () => {
    const customConfig = config();
    customConfig.ocean.maxPages = 1; // Cap at 1 page
    const client = new OceanClient(customConfig);

    client.http.post = jest.fn().mockResolvedValue({
      data: {
        companies: [{ domain: 'page1.com' }],
        searchAfter: 'cursor-token-123'
      }
    });

    const domains = await client.findSimilarDomains('seed.com');
    expect(domains).toEqual(['page1.com']);
    expect(client.http.post).toHaveBeenCalledTimes(1);
  });
});

describe('Prospeo Pagination and PROSPEO_MAX_PAGES', () => {
  test('Prospeo performs page-based pagination up to maxPages', async () => {
    const customConfig = config();
    customConfig.prospeo.maxPages = 2;
    const client = new ProspeoClient(customConfig);

    client.http.post = jest.fn()
      .mockResolvedValueOnce({
        data: {
          results: [{
            person: { full_name: 'Lead 1', current_job_title: 'VP', linkedin_url: 'li1' }
          }],
          pagination: { current_page: 1, total_page: 2 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          results: [{
            person: { full_name: 'Lead 2', current_job_title: 'VP', linkedin_url: 'li2' }
          }],
          pagination: { current_page: 2, total_page: 2 }
        }
      });

    const contacts = await client.findDecisionMakers('example.com');
    expect(contacts).toHaveLength(2);
    expect(contacts[0].fullName).toEqual('Lead 1');
    expect(contacts[1].fullName).toEqual('Lead 2');
    expect(client.http.post).toHaveBeenCalledTimes(2);
    expect(client.http.post.mock.calls[0][1].page).toEqual(1);
    expect(client.http.post.mock.calls[1][1].page).toEqual(2);
  });

  test('Prospeo respects PROSPEO_MAX_PAGES limit and stops early', async () => {
    const customConfig = config();
    customConfig.prospeo.maxPages = 1; // Cap at 1 page
    const client = new ProspeoClient(customConfig);

    client.http.post = jest.fn().mockResolvedValue({
      data: {
        results: [{
          person: { full_name: 'Lead 1', current_job_title: 'VP', linkedin_url: 'li1' }
        }],
        pagination: { current_page: 1, total_page: 3 }
      }
    });

    const contacts = await client.findDecisionMakers('example.com');
    expect(contacts).toHaveLength(1);
    expect(client.http.post).toHaveBeenCalledTimes(1);
  });
});
