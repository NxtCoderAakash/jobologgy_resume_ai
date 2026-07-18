/**
 * Tiny in-memory per-key rate limiter (fixed window). Good enough for a single
 * Render instance — buckets reset on restart, which is acceptable for abuse
 * throttling. Throws a clean 429 (with Retry hint) when the limit is exceeded.
 */
import { HttpError } from "./http.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();

  // Opportunistic prune so the map can't grow unbounded over a long uptime.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= max) {
    const retry = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new HttpError(429, `Too many requests — please wait ${retry}s and try again.`);
  }
  bucket.count++;
}
