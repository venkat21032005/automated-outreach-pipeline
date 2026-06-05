const logger = require('./logger');

/**
 * Executes an asynchronous function with retries using exponential backoff.
 * Gracefully handles 429 Rate Limits by reading the 'Retry-After' header if present.
 * 
 * @param {Function} fn - The asynchronous function to execute.
 * @param {Object} options - Configuration options.
 * @param {number} options.retries - Maximum number of retries.
 * @param {number} options.delay - Initial delay in ms.
 * @param {number} options.factor - Exponential backoff multiplier.
 * @returns {Promise<any>} The result of the fn call.
 */
async function withRetry(fn, options = {}) {
  const { retries = 3, delay = 1000, factor = 2 } = options;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === retries + 1;
      
      // Extract HTTP status and headers if it's an Axios error
      const status = error.response ? error.response.status : null;
      const headers = error.response ? error.response.headers : null;

      logger.warn(`API call failed (Attempt ${attempt}/${retries + 1}). Status: ${status || error.message}`);

      if (isLastAttempt) {
        logger.error(`Max retries reached. Failing operation.`);
        throw error;
      }

      // Check if error is retryable
      // We retry on:
      // 1. Network / timeout errors (no response status)
      // 2. 429 Too Many Requests (Rate Limit)
      // 3. 5xx Server Errors
      const isRateLimited = status === 429;
      const isServerError = status >= 500 && status < 600;
      const isNetworkError = !status;

      const shouldRetry = isRateLimited || isServerError || isNetworkError;

      if (!shouldRetry) {
        // Stop immediately for client errors like 400, 401, 403, 404 (unless rate limited)
        logger.error(`Non-retryable error encountered: ${status || error.message}. Aborting.`);
        throw error;
      }

      let waitTime = currentDelay;

      if (isRateLimited && headers) {
        // Read Retry-After header. It can be:
        // - A decimal integer representing the number of seconds to delay.
        // - An HTTP-date string.
        const retryAfter = headers['retry-after'];
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            waitTime = seconds * 1000;
            logger.warn(`Rate limit (429) detected. 'Retry-After' header specifies waiting ${seconds} seconds.`);
          } else {
            const dateMs = Date.parse(retryAfter);
            if (!isNaN(dateMs)) {
              waitTime = Math.max(0, dateMs - Date.now());
              logger.warn(`Rate limit (429) detected. 'Retry-After' header specifies date-time. Waiting ${Math.round(waitTime / 1000)} seconds.`);
            }
          }
        } else {
          logger.warn(`Rate limit (429) detected, but no 'Retry-After' header found. Using exponential backoff.`);
        }
      }

      logger.info(`Waiting ${waitTime}ms before retrying...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Update delay for next iteration (exponential backoff)
      // Only scale delay if we didn't use a specific 'Retry-After' wait time
      if (!isRateLimited || !headers || !headers['retry-after']) {
        currentDelay *= factor;
      }
    }
  }
}

module.exports = { withRetry };
