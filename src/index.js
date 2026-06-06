#!/usr/bin/env node

const { Command } = require('commander');
const { loadEnv } = require('./config/env');
const { isValidDomain } = require('./utils/validators');
const logger = require('./utils/logger');
const PipelineService = require('./services/pipelineService');

loadEnv();

const program = new Command();

program
  .name('outreach-pipeline')
  .description('Run an automated cold-outreach pipeline from one seed company domain')
  .argument('<company.domain>', 'seed company domain, for example stripe.com')
  .action(async (domain) => {
    if (!isValidDomain(domain)) {
      throw new Error(`Invalid company domain: "${domain}". Use a bare domain such as stripe.com.`);
    }

    const pipeline = new PipelineService();
    await pipeline.run(domain);
  });

program.parseAsync(process.argv).catch((error) => {
  logger.error('Pipeline stopped', { error: error.message });
  process.exitCode = 1;
});
