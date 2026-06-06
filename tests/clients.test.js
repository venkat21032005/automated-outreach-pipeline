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
