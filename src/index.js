#!/usr/bin/env node

// Load environment configurations
require('dotenv').config();

const { Command } = require('commander');
const picocolors = require('picocolors');

const logger = require('./utils/logger');
const { isValidDomain } = require('./utils/validator');
const outreachPipeline = require('./pipeline/outreachPipeline');
const { startServer } = require('./server');

const program = new Command();

program
  .name('outreach-pipeline')
  .description('Automated Outreach Pipeline CLI tool')
  .argument('[domain]', 'Company domain to search lookalikes and decision-makers for (e.g., google.com)')
  .option('--server', 'Start the Express web dashboard server')
  .option('-p, --port <number>', 'Port to host the dashboard on', '3000')
  .option('--resume', 'Resume the pipeline for the given domain from the last saved state')
  .option('--dry-run', 'Execute stages 1-3 but mock actual email sending in stage 4 (Brevo mock)')
  .option('--mock', 'Force mock mode for all APIs (bypasses .env credentials)')
  .option('--csv', 'Export final verified contacts to data/outreach_summary.csv')
  .option('-y, --yes', 'Auto-approve cold email delivery without safety confirmation prompt')
  .action(async (domain, options) => {
    // Override MOCK_MODE environment variable if --mock option is explicitly passed
    if (options.mock) {
      process.env.MOCK_MODE = 'true';
      logger.info('[CLI] Forced Mock Mode enabled.');
    }

    const port = parseInt(options.port, 10) || 3000;
    let serverInstance = null;

    // Start Express dashboard server if --server flag is set
    if (options.server) {
      serverInstance = startServer(port);
    }

    if (domain) {
      // Validate input domain
      if (!isValidDomain(domain)) {
        logger.error(`[CLI] Invalid domain format provided: "${domain}". Please enter a valid domain (e.g., google.com).`);
        if (serverInstance) serverInstance.close();
        process.exit(1);
      }

      try {
        // Run the outreach pipeline
        await outreachPipeline.execute(domain, {
          resume: !!options.resume,
          dryRun: !!options.dryRun,
          autoApprove: !!options.yes,
          exportCsv: !!options.csv
        });

        if (options.server) {
          logger.info(picocolors.green(`\n[CLI] Pipeline finished. The dashboard is still active at http://localhost:${port}`));
          logger.info(picocolors.green(`[CLI] Press Ctrl+C to close the dashboard server.`));
        } else {
          process.exit(0);
        }
      } catch (err) {
        logger.error(`[CLI] Pipeline execution failed: ${err.message}`);
        if (serverInstance) serverInstance.close();
        process.exit(1);
      }
    } else {
      // No domain positional argument provided
      if (options.server) {
        logger.info(`[CLI] Monitor mode active. Open browser to review past logs.`);
      } else {
        // Neither domain nor server was provided, show command line usage help
        program.outputHelp();
      }
    }
  });

program.parse(process.argv);
