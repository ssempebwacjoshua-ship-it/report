import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

function clientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || "unknown";
}

function requestId(req: Request) {
  return typeof req.headers["x-request-id"] === "string"
    ? req.headers["x-request-id"]
    : randomUUID();
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.name}:${options.key?.(req) ?? clientIp(req)}`;
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count <= options.max) {
      next();
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      ok: false,
      error: true,
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait a moment and try again.",
      requestId: requestId(req),
      details: [],
    });
  };
}

export function rateLimitWhen(
  predicate: (req: Request) => boolean,
  limiter: ReturnType<typeof createRateLimiter>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!predicate(req)) {
      next();
      return;
    }
    limiter(req, res, next);
  };
}
