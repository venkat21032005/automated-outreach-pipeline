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

      const retryAfter = parseRetryAfter(error.response?.headers?.['retry-after']);
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
