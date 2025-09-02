// src/app/actions.js
// Persistência de dados da família (server-side) sem fetch interno.
// Suporta automaticamente:
//  1) Redis URL (ioredis) via REDIS_URL ou redis_url
//  2) Upstash REST via UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

"use server"

let cached = {
  mode: null,       // "ioredis" | "upstash" | "memory"
  io: null,         // cliente ioredis
};

// ----------------- helpers -----------------
const KEY = (slug) => `gastos-familia:${slug}`;

function safeJSONparse(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

// ----------------- Upstash REST -----------------
async function upstashGet(k) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${base}/get/${encodeURIComponent(k)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash GET falhou: ${res.status}`);
  const data = await res.json(); // { result: "..." | null }
  return data?.result ?? null;
}

async function upstashSet(k, v) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${base}/set/${encodeURIComponent(k)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([v]),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upstash SET falhou: ${res.status} ${txt}`);
  }
}

// ----------------- ioredis (Redis URL) -----------------
async function getIoRedis() {
  if (cached.io) return cached.io;

  const url = process.env.REDIS_URL || process.env.redis_url || "";
  if (!url) return null;

  // Carrega ioredis sob demanda (só no server)
  const { default: Redis } = await import("ioredis");
  // TLS automático quando necessário (Upstash/Render/Heroku etc)
  const isTLS = url.startsWith("rediss://");
  const client = new Redis(url, isTLS ? { tls: { rejectUnauthorized: false } } : {});
  cached.io = client;
  return client;
}

// ----------------- init modo -----------------
async function ensureMode() {
  if (cached.mode) return cached.mode;

  // Prioridade 1: Upstash REST se variáveis presentes
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    cached.mode = "upstash";
    return cached.mode;
  }

  // Prioridade 2: Redis URL (ioredis) se presente
  const url = process.env.REDIS_URL || process.env.redis_url;
  if (url) {
    // valida criação do client
    const io = await getIoRedis().catch(() => null);
    if (io) {
      cached.mode = "ioredis";
      return cached.mode;
    }
  }

  // Fallback 3: memória (não persiste entre execuções; apenas para dev)
  console.warn("[actions] Nenhuma configuração de Redis detectada. Usando memória (NÃO persistente).");
  cached.mode = "memory";
  return cached.mode;
}

// ----------------- memória (fallback) -----------------
const mem = new Map();

// ----------------- API pública -----------------
export async function carregarFamilia(slug) {
  const mode = await ensureMode();
  const key = KEY(slug);

  if (mode === "upstash") {
    const raw = await upstashGet(key);
    return safeJSONparse(raw);
  }
  if (mode === "ioredis") {
    const io = await getIoRedis();
    const raw = await io.get(key);
    return safeJSONparse(raw);
  }
  // memory
  return mem.get(key) ?? null;
}

export async function salvarFamilia(slug, doc) {
  const mode = await ensureMode();
  const key = KEY(slug);
  const payload = JSON.stringify(doc || {});

  if (mode === "upstash") {
    await upstashSet(key, payload);
    return { ok: true };
  }
  if (mode === "ioredis") {
    const io = await getIoRedis();
    await io.set(key, payload);
    return { ok: true };
  }
  // memory
  mem.set(key, payload);
  return { ok: true };
}
