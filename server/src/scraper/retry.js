/**
 * @file retry.js
 * @description Exponential backoff retry utility with jitter for browser page operations.
 *
 * REASONING:
 * 1. Whole Page Load vs Sub-Step Retries:
 *    The target site's gated authentication chain is stateful:
 *    - Solving the WASM Proof-of-Work unlocks a single-use session token valid for only 30s.
 *    - If sub-step retries are attempted (e.g. retrying only DOM polling after token expiration),
 *      the API returns 401 and the page locks up.
 *    - Therefore, the entire page load (fresh goto and clean page state) must be retried from scratch.
 *
 * 2. Exponential Backoff with Jitter:
 *    - Retries follow 1s -> 2s -> 4s base delays with a randomized 0-300ms jitter.
 *    - Jitter avoids synchronized retry spikes against the target server, reducing the risk of rate-limiting.
 */

import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Calculates exponential backoff delay with jitter.
 * Formula: baseDelay * 2^(attempt - 1) + random(0, 300ms)
 *
 * @param {number} attempt - Current 1-indexed attempt number
 * @param {number} [baseDelayMs=1000] - Base delay in milliseconds (1s)
 * @returns {number}
 */
export function calculateBackoff(attempt, baseDelayMs = 1000) {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 300);
  return exponential + jitter;
}

/**
 * Executes an async operation with exponential backoff retries.
 *
 * @template T
 * @param {() => Promise<T>} operation - Function to execute
 * @param {Object} [options]
 * @param {number} [options.maxAttempts] - Maximum attempts before giving up
 * @param {number} [options.baseDelayMs=1000] - Starting backoff delay in ms
 * @param {(err: Error, attempt: number, delayMs: number) => void} [options.onRetry] - Callback on retry
 * @returns {Promise<{ result: T, attemptCount: number }>}
 */
export async function withRetry(operation, options = {}) {
  const maxAttempts = options.maxAttempts || config.scrapeMaxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 1000;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return { result, attemptCount: attempt };
    } catch (err) {
      lastError = err;

      if (attempt < maxAttempts) {
        const delayMs = calculateBackoff(attempt, baseDelayMs);
        if (options.onRetry) {
          options.onRetry(err, attempt, delayMs);
        } else {
          logger.warn(`Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // If all attempts exhausted, attach attempt count to error
  lastError.attemptCount = maxAttempts;
  throw lastError;
}

export default {
  calculateBackoff,
  withRetry,
};
