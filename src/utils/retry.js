const logger = require('./logger');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withRetry(operation, options = {}) {
  const {
    retries = 3,
    baseDelayMs = options.delay || 1000,
    factor = 2,
    label = 'API request'
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt >= retries) throw error;

      const headers = error.response?.headers || {};
      const retryAfterHeader = headers['retry-after'];
      const xSecondReset = headers['x-second-reset-seconds'];
      const xMinuteReset = headers['x-minute-reset-seconds'];

      let retryAfter = parseRetryAfter(retryAfterHeader);

      if (xSecondReset) {
        const xSecondMs = Number.parseFloat(xSecondReset) * 1000;
        if (Number.isFinite(xSecondMs)) {
          retryAfter = Math.max(retryAfter || 0, xSecondMs + 100);
        }
      }

      if (xMinuteReset) {
        const xMinuteMs = Number.parseFloat(xMinuteReset) * 1000;
        if (Number.isFinite(xMinuteMs)) {
          retryAfter = Math.max(retryAfter || 0, xMinuteMs + 500);
        }
      }

      const delayMs = retryAfter ?? baseDelayMs * factor ** attempt;
      attempt += 1;
      logger.warn(`${label} failed; retrying`, { attempt, status, delayMs });
      await sleep(delayMs);
    }
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}

module.exports = { withRetry, sleep };
