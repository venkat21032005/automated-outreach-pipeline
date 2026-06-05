const { withRetry } = require('../src/utils/retry');

// Mock the Winston logger to prevent polluting test outputs
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Retry Utility Tests', () => {
  test('should succeed immediately if the function resolves', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { retries: 2, delay: 5 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry and succeed if the function eventually resolves', async () => {
    let attempt = 0;
    const fn = jest.fn().mockImplementation(async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error('Network error');
      }
      return 'recovered';
    });

    const result = await withRetry(fn, { retries: 3, delay: 5, factor: 1.5 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('should fail and throw if maximum retries are reached', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Persistent error'));

    await expect(withRetry(fn, { retries: 2, delay: 5 }))
      .rejects.toThrow('Persistent error');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  test('should fail immediately on client errors (400, 401, 403, 404)', async () => {
    const clientError = new Error('Request failed with status 404');
    clientError.response = { status: 404 };
    
    const fn = jest.fn().mockRejectedValue(clientError);

    await expect(withRetry(fn, { retries: 2, delay: 5 }))
      .rejects.toThrow('Request failed with status 404');

    expect(fn).toHaveBeenCalledTimes(1); // Aborts immediately
  });

  test('should parse Retry-After header and wait accordingly on 429 errors', async () => {
    const rateLimitError = new Error('Too Many Requests');
    rateLimitError.response = {
      status: 429,
      headers: {
        'retry-after': '1' // specify waiting 1 second (1000ms)
      }
    };

    let attempt = 0;
    const fn = jest.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        throw rateLimitError;
      }
      return 'success';
    });

    const startTime = Date.now();
    const result = await withRetry(fn, { retries: 1, delay: 5 });
    const duration = Date.now() - startTime;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    // Should have waited at least 1000ms due to the mock header
    expect(duration).toBeGreaterThanOrEqual(950);
  });
});
