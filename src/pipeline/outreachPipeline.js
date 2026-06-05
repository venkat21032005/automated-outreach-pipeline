const fs = require('fs');
const path = require('path');
const readline = require('readline');
const picocolors = require('picocolors');
const Table = require('cli-table3');
const { createObjectCsvWriter } = require('csv-writer');

const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');
const oceanService = require('../services/ocean.service');
const prospeoService = require('../services/prospeo.service');
const eazyreachService = require('../services/eazyreach.service');
const brevoService = require('../services/brevo.service');

// Constants for file paths
const DATA_DIR = path.join(__dirname, '../../data');
const SIMILAR_COMPANIES_FILE = path.join(DATA_DIR, 'similarCompanies.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const VERIFIED_EMAILS_FILE = path.join(DATA_DIR, 'verifiedEmails.json');
const EMAIL_SUMMARY_FILE = path.join(DATA_DIR, 'emailSummary.json');
const STATE_FILE = path.join(DATA_DIR, 'pipelineState.json');
const CSV_EXPORT_FILE = path.join(DATA_DIR, 'outreach_summary.csv');

class OutreachPipeline {
  constructor() {
    this.state = this.getInitialState();
    this.ensureDirectoriesExist();
  }

  /**
   * Generates default blank state configuration.
   */
  getInitialState() {
    return {
      targetDomain: '',
      currentStage: 1,
      similarCompanies: [],
      prospeoProcessedDomains: [],
      contacts: [],
      eazyreachProcessedUrls: [],
      verifiedEmails: [],
      emailsSent: []
    };
  }

  /**
   * Helper to ensure required folders exist.
   */
  ensureDirectoriesExist() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Loads cached pipeline state if it matches the domain name.
   */
  loadState(domain) {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const fileContent = fs.readFileSync(STATE_FILE, 'utf8');
        const savedState = JSON.parse(fileContent);
        if (savedState.targetDomain === domain.toLowerCase().trim()) {
          this.state = savedState;
          logger.info(`[Pipeline] Loaded existing progress state for: ${domain}. Resuming from Stage ${this.state.currentStage}.`);
          return true;
        }
      } catch (err) {
        logger.error(`[Pipeline] Failed to parse existing state file: ${err.message}. Starting fresh.`);
      }
    }
    return false;
  }

  /**
   * Save the current execution progress state to state file.
   */
  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf8');
      logger.debug(`[Pipeline] Progress state saved successfully.`);
    } catch (err) {
      logger.error(`[Pipeline] Failed to write progress state: ${err.message}`);
    }
  }

  /**
   * Reset / Delete state file once the pipeline completes.
   */
  clearState() {
    if (fs.existsSync(STATE_FILE)) {
      try {
        fs.unlinkSync(STATE_FILE);
        logger.debug(`[Pipeline] State cache cleared.`);
      } catch (err) {
        logger.error(`[Pipeline] Failed to delete state cache: ${err.message}`);
      }
    }
  }

  /**
   * Runs the complete outreach pipeline for a domain.
   * 
   * @param {string} domain - The target company domain.
   * @param {Object} options - Configuration parameters.
   * @param {boolean} options.resume - Whether to resume a cached run.
   * @param {boolean} options.dryRun - Whether to run email sending as dry-run.
   * @param {boolean} options.autoApprove - Skip the interactive prompt.
   * @param {boolean} options.exportCsv - Export verified contacts to CSV.
   */
  async execute(domain, options = {}) {
    logger.info(`[Pipeline] Starting Automated Outreach Pipeline for domain: ${domain}`);
    this.ensureDirectoriesExist();

    const cleanDomain = domain.toLowerCase().trim();

    // Try loading state if resume mode is requested
    let isResumed = false;
    if (options.resume) {
      isResumed = this.loadState(cleanDomain);
    }

    if (!isResumed) {
      this.state = this.getInitialState();
      this.state.targetDomain = cleanDomain;
      this.saveState();
    }

    try {
      // Stage 1: Ocean.io lookup
      if (this.state.currentStage === 1) {
        logger.info(picocolors.blue('\n--- STAGE 1: Ocean.io Integration ---'));
        
        // Wrapped with retry mechanism
        const similarCompanies = await withRetry(
          () => oceanService.getSimilarCompanies(cleanDomain),
          { retries: 3, delay: 1000 }
        );

        // Save stage results
        this.state.similarCompanies = similarCompanies;
        fs.writeFileSync(SIMILAR_COMPANIES_FILE, JSON.stringify(similarCompanies, null, 2), 'utf8');
        logger.info(`[Pipeline] Stage 1 finished. Saved similarity results to ${path.basename(SIMILAR_COMPANIES_FILE)}`);

        this.state.currentStage = 2;
        this.saveState();
      }

      // Stage 2: Prospeo decision-makers
      if (this.state.currentStage === 2) {
        logger.info(picocolors.blue('\n--- STAGE 2: Prospeo Integration ---'));
        
        const companiesToProcess = this.state.similarCompanies;
        
        for (let i = 0; i < companiesToProcess.length; i++) {
          const compDomain = companiesToProcess[i];

          // Skip if already processed in a previous interrupted run
          if (this.state.prospeoProcessedDomains.includes(compDomain)) {
            logger.info(`[Pipeline] Skipping already processed domain: ${compDomain}`);
            continue;
          }

          logger.info(`[Pipeline] Processing company ${i + 1}/${companiesToProcess.length}: ${compDomain}`);
          
          // Call Prospeo with retry
          const domainContacts = await withRetry(
            () => prospeoService.getContacts(compDomain),
            { retries: 2, delay: 1500 }
          );

          // Merge and deduplicate contacts based on LinkedIn URL (if present) or name/domain combo
          for (const newContact of domainContacts) {
            const isDuplicate = this.state.contacts.some(existing => {
              if (newContact.linkedin && existing.linkedin) {
                return newContact.linkedin.toLowerCase() === existing.linkedin.toLowerCase();
              }
              return newContact.name.toLowerCase() === existing.name.toLowerCase() && 
                     newContact.companyDomain.toLowerCase() === existing.companyDomain.toLowerCase();
            });

            if (!isDuplicate) {
              this.state.contacts.push(newContact);
            } else {
              logger.debug(`[Deduplication] Removed duplicate contact: ${newContact.name} from ${newContact.companyDomain}`);
            }
          }

          // Mark domain as completed
          this.state.prospeoProcessedDomains.push(compDomain);
          this.saveState();
        }

        // Save stage results
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(this.state.contacts, null, 2), 'utf8');
        logger.info(`[Pipeline] Stage 2 finished. Saved contacts to ${path.basename(CONTACTS_FILE)}`);

        this.state.currentStage = 3;
        this.saveState();
      }

      // Stage 3: Eazyreach work email finder
      if (this.state.currentStage === 3) {
        logger.info(picocolors.blue('\n--- STAGE 3: Eazyreach Integration ---'));

        const contactsToProcess = this.state.contacts;
        
        for (let i = 0; i < contactsToProcess.length; i++) {
          const contact = contactsToProcess[i];

          // Skip if contact doesn't have a LinkedIn URL
          if (!contact.linkedin) {
            logger.warn(`[Pipeline] Contact ${contact.name} has no LinkedIn URL. Skipping.`);
            continue;
          }

          // Skip if already processed in previous interrupted run
          if (this.state.eazyreachProcessedUrls.includes(contact.linkedin)) {
            logger.debug(`[Pipeline] Skipping already enriched LinkedIn URL: ${contact.linkedin}`);
            continue;
          }

          logger.info(`[Pipeline] Resolving email for contact ${i + 1}/${contactsToProcess.length}: ${contact.name} (${contact.companyName})`);

          // Fetch verified email with retry
          const verifiedEmail = await withRetry(
            () => eazyreachService.getEmailByLinkedin(contact.linkedin, contact.name, contact.companyDomain),
            { retries: 2, delay: 1000 }
          );

          if (verifiedEmail) {
            // Deduplicate: check if email is already in verifiedEmails
            const isEmailDuplicate = this.state.verifiedEmails.some(existing => 
              existing.email.toLowerCase() === verifiedEmail.toLowerCase()
            );

            if (!isEmailDuplicate) {
              this.state.verifiedEmails.push({
                ...contact,
                email: verifiedEmail
              });
            } else {
              logger.warn(`[Deduplication] Email already verified for another contact: ${verifiedEmail}. Skipping.`);
            }
          }

          // Mark URL as processed (even if email resolving failed or skipped)
          this.state.eazyreachProcessedUrls.push(contact.linkedin);
          this.saveState();
        }

        // Save stage results
        fs.writeFileSync(VERIFIED_EMAILS_FILE, JSON.stringify(this.state.verifiedEmails, null, 2), 'utf8');
        logger.info(`[Pipeline] Stage 3 finished. Saved verified emails to ${path.basename(VERIFIED_EMAILS_FILE)}`);

        this.state.currentStage = 4;
        this.saveState();
      }

      // Export CSV option if selected
      if (options.exportCsv) {
        await this.exportToCsv();
      }

      // Stage 4: Brevo Email Outreach
      if (this.state.currentStage === 4) {
        logger.info(picocolors.blue('\n--- SAFETY CHECKPOINT ---'));
        
        if (this.state.verifiedEmails.length === 0) {
          logger.warn(`[Pipeline] No verified contacts found to email. Exiting.`);
          this.clearState();
          return;
        }

        // Display summary table using cli-table3
        this.displaySummaryTable(this.state.verifiedEmails);

        // Perform validation check prompt
        let proceed = false;
        if (options.autoApprove) {
          logger.info(`[Pipeline] Auto-approve flag set. Skipping prompt and sending emails.`);
          proceed = true;
        } else {
          proceed = await this.askForConfirmation();
        }

        if (!proceed) {
          logger.warn(`[Pipeline] Email sending aborted by user. Progress state saved. You can resume later using --resume.`);
          return;
        }

        logger.info(picocolors.blue('\n--- STAGE 4: Brevo Integration ---'));
        
        const emailsToProcess = this.state.verifiedEmails;
        const emailSummary = [];

        for (let i = 0; i < emailsToProcess.length; i++) {
          const recipient = emailsToProcess[i];

          // Skip if email was already sent in an interrupted run
          if (this.state.emailsSent.includes(recipient.email)) {
            logger.info(`[Pipeline] Email already sent to: ${recipient.email}. Skipping.`);
            emailSummary.push({
              email: recipient.email,
              name: recipient.name,
              status: 'previously_sent'
            });
            continue;
          }

          logger.info(`[Pipeline] Sending email ${i + 1}/${emailsToProcess.length} to: ${recipient.email}`);
          
          try {
            // Call Brevo with retry
            const success = await withRetry(
              () => brevoService.sendOutreachEmail(recipient, options.dryRun),
              { retries: 2, delay: 1000 }
            );

            if (success) {
              this.state.emailsSent.push(recipient.email);
              this.saveState();
              
              emailSummary.push({
                email: recipient.email,
                name: recipient.name,
                status: 'success',
                sentAt: new Date().toISOString()
              });
            } else {
              emailSummary.push({
                email: recipient.email,
                name: recipient.name,
                status: 'failed'
              });
            }
          } catch (err) {
            logger.error(`[Pipeline] Failed to complete email delivery for ${recipient.email}: ${err.message}`);
            emailSummary.push({
              email: recipient.email,
              name: recipient.name,
              status: 'failed',
              error: err.message
            });
          }
        }

        // Save stage results
        fs.writeFileSync(EMAIL_SUMMARY_FILE, JSON.stringify(emailSummary, null, 2), 'utf8');
        logger.info(`[Pipeline] Stage 4 finished. Saved summary to ${path.basename(EMAIL_SUMMARY_FILE)}`);

        // Finalize state
        this.clearState();
        logger.info(picocolors.green('\n======================================'));
        logger.info(picocolors.green('🎉 PIPELINE COMPLETED SUCCESSFULLY!'));
        logger.info(picocolors.green('======================================'));
      }

    } catch (err) {
      logger.error(`[Pipeline] CRITICAL ERROR occurred in stage ${this.state.currentStage}: ${err.message}`);
      logger.error(`[Pipeline] Progress state has been preserved. You can resume this execution later.`);
      throw err;
    }
  }

  /**
   * Formats and prints verified contacts in a clean, retro/premium terminal table.
   * 
   * @param {Object[]} records - List of enriched contacts.
   */
  displaySummaryTable(records) {
    const table = new Table({
      head: [
        picocolors.bold('Company Name'), 
        picocolors.bold('Contact Name'), 
        picocolors.bold('Designation'), 
        picocolors.bold('Email Address')
      ],
      colWidths: [22, 22, 28, 30],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    records.forEach(rec => {
      table.push([
        rec.companyName || rec.companyDomain,
        rec.name,
        rec.title || 'N/A',
        rec.email
      ]);
    });

    console.log('\nPROPOSED EMAIL RECIPIENTS:');
    console.log(table.toString());
    console.log(`Total verified contacts ready for outreach: ${records.length}\n`);
  }

  /**
   * Prompts user in console to confirm before sending outreach emails.
   * 
   * @returns {Promise<boolean>} True if confirmed.
   */
  askForConfirmation() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = picocolors.yellow(picocolors.bold('Do you want to send emails? (yes/no): '));
      
      rl.question(question, (answer) => {
        rl.close();
        const cleanAnswer = answer.toLowerCase().trim();
        if (cleanAnswer === 'yes' || cleanAnswer === 'y') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Exports the verified email records into a clean formatted CSV file.
   */
  async exportToCsv() {
    logger.info(`[CSV Export] Creating CSV list of verified contacts...`);
    try {
      const records = this.state.verifiedEmails;
      if (records.length === 0) {
        logger.warn(`[CSV Export] No verified contacts available to export.`);
        return;
      }

      const csvWriter = createObjectCsvWriter({
        path: CSV_EXPORT_FILE,
        header: [
          { id: 'companyName', title: 'Company Name' },
          { id: 'companyDomain', title: 'Company Domain' },
          { id: 'name', title: 'Contact Name' },
          { id: 'title', title: 'Designation' },
          { id: 'email', title: 'Email' },
          { id: 'linkedin', title: 'LinkedIn URL' }
        ]
      });

      await csvWriter.writeRecords(records);
      logger.info(`[CSV Export] CSV file successfully saved at: ${CSV_EXPORT_FILE}`);
    } catch (err) {
      logger.error(`[CSV Export] Failed to export CSV: ${err.message}`);
    }
  }
}

module.exports = new OutreachPipeline();
