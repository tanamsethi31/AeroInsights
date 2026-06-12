// api/_lib/rateLimit.ts
//
// Shared Upstash Redis rate-limit helper used by api/ai/chat.ts and
// api/ai/narrative.ts. Both endpoints proxy to the same upstream LLM
// providers, so they must share counters — otherwise an attacker who
// hits chat's daily cap can keep going by switching to narrative.
//
// Three counters incremented in a single pipeline:
//   - per-user per-minute  (burst protection)
//   - per-user per-day     (daily cap)
//   - global per-day       (platform cap)
//
// Fails OPEN if Upstash env isn't configured (local dev). Production
// must have UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set.

const USER_DAILY_LIMIT   = parseInt(process.env.AI_USER_DAILY_LIMIT   ?? "50", 10);
const USER_MINUTE_LIMIT  = parseInt(process.env.AI_USER_MINUTE_LIMIT  ?? "3",  10);
const GLOBAL_DAILY_LIMIT = parseInt(process.env.AI_GLOBAL_DAILY_LIMIT ?? "50", 10);

function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function utcMinuteKey(): string {
  return new Date().toISOString().slice(0, 16).replace(":", "-");
}

export type RateLimitResult =
  | { allowed: true;  userCount: number; globalCount: number; userLimit: number; globalLimit: number }
  | { allowed: false; reason: string };

export async function checkAndIncrementAiLimits(userId: string): Promise<RateLimitResult> {
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return { allowed: true, userCount: 0, globalCount: 0, userLimit: USER_DAILY_LIMIT, globalLimit: GLOBAL_DAILY_LIMIT };
  }

  const date      = utcDateKey();
  const minute    = utcMinuteKey();
  const userKey   = `ai:${date}:u:${userId}`;
  const minuteKey = `ai:${minute}:um:${userId}`;
  const globalKey = `ai:${date}:global`;
  const dayTtl    = 90000;
  const minTtl    = 120;

  const pipeline = [
    ["INCR", userKey],
    ["EXPIRE", userKey, dayTtl],
    ["INCR", minuteKey],
    ["EXPIRE", minuteKey, minTtl],
    ["INCR", globalKey],
    ["EXPIRE", globalKey, dayTtl],
  ];

  try {
    const res = await fetch(`${upstashUrl}/pipeline`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(pipeline),
    });
    if (!res.ok) {
      return { allowed: true, userCount: 0, globalCount: 0, userLimit: USER_DAILY_LIMIT, globalLimit: GLOBAL_DAILY_LIMIT };
    }
    const data        = await res.json() as Array<{ result: number }>;
    const userCount   = data[0]?.result ?? 0;
    const minuteCount = data[2]?.result ?? 0;
    const globalCount = data[4]?.result ?? 0;

    if (minuteCount > USER_MINUTE_LIMIT) {
      return {
        allowed: false,
        reason: `Too many requests. Please wait a minute before trying again (limit ${USER_MINUTE_LIMIT}/min).`,
      };
    }
    if (userCount > USER_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `You have used all ${USER_DAILY_LIMIT} AI queries for today. Resets at midnight UTC.`,
      };
    }
    if (globalCount > GLOBAL_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: "The platform's daily AI capacity has been reached. Please try again tomorrow.",
      };
    }
    return { allowed: true, userCount, globalCount, userLimit: USER_DAILY_LIMIT, globalLimit: GLOBAL_DAILY_LIMIT };
  } catch {
    return { allowed: true, userCount: 0, globalCount: 0, userLimit: USER_DAILY_LIMIT, globalLimit: GLOBAL_DAILY_LIMIT };
  }
}
