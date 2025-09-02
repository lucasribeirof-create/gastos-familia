// src/utils/db.js
import Redis from "ioredis"

const url = process.env.REDIS_URL
if (!url) {
  console.warn("[WARN] REDIS_URL não definido. A API vai falhar ao persistir.")
}

export const redis = new Redis(url, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: false,
  tls: url?.startsWith("rediss://") ? {} : undefined,
})
