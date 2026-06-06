const fs = require('fs/promises');
const path = require('path');
const OceanClient = require('../clients/oceanClient');
const ProspeoClient = require('../clients/prospeoClient');
const EazyreachClient = require('../clients/eazyreachClient');
const BrevoClient = require('../clients/brevoClient');
const { loadEnv, validatePipelineEnv } = require('../config/env');
const { cleanDomain } = require('../utils/normalize');
const { isValidEmail, isVerifiedStatus } = require('../utils/validators');
const logger = require('../utils/logger');
const { dedupeContacts } = require('./dedupeService');
const { printSummary, confirmSend } = require('./checkpointService');
const { composeEmail } = require('./emailComposer');

class PipelineService {
  constructor(dependencies = {}) {
    this.config = dependencies.config || loadEnv();
    this.ocean = dependencies.ocean || new OceanClient(this.config);
    this.prospeo = dependencies.prospeo || new ProspeoClient(this.config);
    this.eazyreach = dependencies.eazyreach || new EazyreachClient(this.config);
    this.brevo = dependencies.brevo || new BrevoClient(this.config);
    this.outputDir = path.resolve(process.cwd(), 'output');
    this.errors = [];
  }

  async run(seedDomain) {
    validatePipelineEnv(this.config);
    await fs.mkdir(this.outputDir, { recursive: true });
    const domain = cleanDomain(seedDomain);
    logger.info('Starting pipeline', { seedDomain: domain });

    let similarDomains;
    try {
      similarDomains = await this.ocean.findSimilarDomains(domain);
    } catch (error) {
      this.errors.push(toErrorRecord('Ocean.io', error));
      const summary = {
        seedDomain: domain,
        domainsFound: 0,
        contactsFound: 0,
        verifiedEmailsFound: 0,
        duplicatesRemoved: 0,
        finalRecipients: 0,
        errors: this.errors.length,
        generatedAt: new Date().toISOString()
      };
      await Promise.all([
        this.writeJson('leads.json', []),
        this.writeJson('sent.json', []),
        this.writeJson('errors.json', this.errors),
        this.writeJson('summary.json', summary)
      ]);
      throw error;
    }
    logger.info('Ocean.io stage complete', { domainsFound: similarDomains.length });

    const contactResults = await mapSettledWithConcurrency(
      similarDomains,
      this.config.concurrency,
      (companyDomain) => this.prospeo.findDecisionMakers(companyDomain)
    );
    const rawContacts = this.collectResults(contactResults, 'Prospeo');
    const initialDedupe = dedupeContacts(rawContacts);
    logger.info('Prospeo stage complete', { contactsFound: rawContacts.length });

    const enrichable = initialDedupe.contacts.filter((contact) => contact.linkedinUrl);
    const enrichmentResults = await mapSettledWithConcurrency(
      enrichable,
      this.config.concurrency,
      (contact) => this.eazyreach.enrichByLinkedin(contact)
    );
    const enriched = this.collectResults(enrichmentResults, 'Eazyreach');
    const finalDedupe = dedupeContacts(enriched);
    const recipients = finalDedupe.contacts.filter((contact) =>
      contact.linkedinUrl && isValidEmail(contact.workEmail) && isVerifiedStatus(contact.emailStatus)
    );

    const summary = {
      seedDomain: domain,
      domainsFound: similarDomains.length,
      contactsFound: rawContacts.length,
      verifiedEmailsFound: enriched.filter((contact) =>
        isValidEmail(contact.workEmail) && isVerifiedStatus(contact.emailStatus)
      ).length,
      duplicatesRemoved: initialDedupe.duplicatesRemoved + finalDedupe.duplicatesRemoved,
      finalRecipients: recipients.length,
      errors: this.errors.length,
      generatedAt: new Date().toISOString()
    };

    await this.writeJson('leads.json', finalDedupe.contacts);
    await this.writeJson('errors.json', this.errors);
    await this.writeJson('summary.json', summary);
    printSummary(summary, recipients);

    if (!recipients.length) {
      logger.warn('No verified recipients available; nothing will be sent');
      await this.writeJson('sent.json', []);
      return summary;
    }

    if (!(await confirmSend())) {
      logger.info('Sending cancelled at safety checkpoint');
      await this.writeJson('sent.json', []);
      return summary;
    }

    const sendResults = await mapSettledWithConcurrency(
      recipients,
      this.config.concurrency,
      (contact) => this.brevo.send(contact, composeEmail(contact, this.config.brevo.senderName))
    );
    const sent = this.collectResults(sendResults, 'Brevo');
    summary.sent = sent.length;
    summary.errors = this.errors.length;
    summary.completedAt = new Date().toISOString();

    await this.writeJson('sent.json', sent);
    await this.writeJson('errors.json', this.errors);
    await this.writeJson('summary.json', summary);
    logger.info('Pipeline complete', { sent: sent.length, errors: this.errors.length });
    return summary;
  }

  collectResults(results, stage) {
    const values = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        values.push(...(Array.isArray(result.value) ? result.value : [result.value]));
      } else {
        const error = toErrorRecord(stage, result.reason);
        this.errors.push(error);
        logger.error(`${stage} item failed`, error);
      }
    }
    return values.filter(Boolean);
  }

  async writeJson(filename, data) {
    await fs.writeFile(path.join(this.outputDir, filename), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
}

async function mapSettledWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );
  return results;
}

function toErrorRecord(stage, error) {
  return {
    stage,
    message: error?.message || String(error),
    status: error?.response?.status || null,
    response: error?.response?.data || null,
    occurredAt: new Date().toISOString()
  };
}

module.exports = PipelineService;
module.exports.mapSettledWithConcurrency = mapSettledWithConcurrency;
