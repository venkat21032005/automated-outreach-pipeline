const axios = require('axios');
const logger = require('../utils/logger');

class BrevoService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'outreach@yourdomain.com';
    this.senderName = process.env.BREVO_SENDER_NAME || 'Outreach Team';
    // Fall back to Mock mode if explicit in env, if key is missing, or is the example placeholder
    this.isMock = process.env.MOCK_MODE === 'true' || !this.apiKey || this.apiKey === 'your_brevo_api_key_here';
  }

  /**
   * Generates a professional email template.
   * 
   * @param {string} contactName - Name of the prospect.
   * @param {string} title - Job title.
   * @param {string} companyName - Company name.
   * @returns {Object} Subject, textContent, and htmlContent.
   */
  generateTemplate(contactName, title, companyName) {
    const firstName = contactName.split(' ')[0];
    const subject = `Strategic Collaboration with ${companyName} - Outreach Operations`;
    
    const textContent = `Hi ${firstName},

I hope this email finds you well.

I've been following ${companyName}'s growth, and given your role as ${title || 'Leader'}, I wanted to reach out. We specialize in automating data outreach pipelines that integrate directly with systems like Ocean.io and Prospeo.

I would love to learn more about your current strategy at ${companyName} and share how we can save your team up to 15 hours per week by automating outbound processes.

Do you have 10 minutes next week for a brief introductory call?

Best regards,

${this.senderName}
${this.senderEmail}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; border: 1px solid #eeeeee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #1a73e8; margin-top: 0;">Hi ${firstName},</h2>
        <p>I hope this email finds you well.</p>
        <p>I've been following <strong>${companyName}</strong>'s impressive achievements, and given your role as <strong>${title || 'Leader'}</strong>, I wanted to connect.</p>
        <p>We specialize in building automated outreach pipelines that integrate with data sources like Ocean.io, Prospeo, and Eazyreach to source validated decision-maker contacts and streamline communications.</p>
        <p>I would love to learn more about your current operations at ${companyName} and share how we can save your team hours of manual extraction work every week.</p>
        <p>Do you have 10 minutes next week for a brief introductory call?</p>
        <br/>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        <p style="margin-bottom: 0;">Best regards,</p>
        <p style="margin-top: 5px;"><strong>${this.senderName}</strong><br/>
        <span style="color: #666666; font-size: 0.9em;">Email: ${this.senderEmail}</span></p>
      </div>
    `;

    return { subject, textContent, htmlContent };
  }

  /**
   * Sends a personalized email.
   * 
   * @param {Object} recipient - { email, name, title, companyName }
   * @param {boolean} isDryRun - If true, simulate email sending.
   * @returns {Promise<boolean>} True if sent successfully.
   */
  async sendOutreachEmail(recipient, isDryRun = false) {
    const { email, name, title, companyName } = recipient;
    const { subject, textContent, htmlContent } = this.generateTemplate(name, title, companyName);

    if (isDryRun || this.isMock) {
      const modeText = isDryRun ? 'DRY-RUN' : 'MOCK';
      logger.info(`[Brevo ${modeText}] Sending outreach email to: ${name} <${email}>`);
      logger.debug(`[Brevo ${modeText}] Subject: ${subject}`);
      logger.debug(`[Brevo ${modeText}] HTML Body snippet: ${htmlContent.substring(0, 150)}...`);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return true;
    }

    logger.info(`[Brevo API] Sending transactional email to: ${name} <${email}>`);
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: this.senderName, email: this.senderEmail },
          to: [ { email: email, name: name } ],
          subject: subject,
          htmlContent: htmlContent,
          textContent: textContent
        },
        {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.messageId) {
        logger.info(`[Brevo API] Email successfully sent. Message ID: ${response.data.messageId}`);
        return true;
      }
      logger.warn(`[Brevo API] Response did not contain messageId:`, response.data);
      return false;
    } catch (error) {
      const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
      logger.error(`[Brevo API] Failed to send email to ${email}: ${errMsg}`);
      throw error;
    }
  }
}

module.exports = new BrevoService();
