// src/app/api/family/[slug]/route.js
import { NextResponse } from "next/server"
import Redis from "ioredis"
import { getToken } from "next-auth/jwt"

// Garantir Node.js (ioredis precisa do runtime Node)
export const runtime = "nodejs"
// Essas páginas não são estáticas
export const dynamic = "force-dynamic"
export const revalidate = 0

// Conexão com o Redis usando a variável da Vercel: REDIS_URL
const redis = new Redis(process.env.REDIS_URL)

// Documento padrão na primeira vez
const DEFAULT_DOC = {
  people: [],
  categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
  expenses: [], // { id, who, category, amount, desc, date }
  updatedAt: null,
}

const key = (slug) => `family:${slug}`

async function requireAuth(req) {
  const token = await getToken({ req })
  if (!token) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 })
  }
  return null
}

export async function GET(req, { params }) {
  const slug = decodeURIComponent(params?.slug || "").trim()
  if (!slug) return NextResponse.json({ error: "slug inválido" }, { status: 400 })

  const authErr = await requireAuth(req)
  if (authErr) return authErr

  try {
    const raw = await redis.get(key(slug))
    if (!raw) {
      const doc = { ...DEFAULT_DOC, updatedAt: new Date().toISOString() }
      await redis.set(key(slug), JSON.stringify(doc))
      return NextResponse.json(doc, { status: 200 })
    }
    return NextResponse.json(JSON.parse(raw), { status: 200 })
  } catch {
    return NextResponse.json({ error: "falha ao ler dados" }, { status: 500 })
  }
}

export async function PUT(req, { params }) {
  const slug = decodeURIComponent(params?.slug || "").trim()
  if (!slug) return NextResponse.json({ error: "slug inválido" }, { status: 400 })

  const authErr = await requireAuth(req)
  if (authErr) return authErr

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  // Checagem simples de formato
  if (!body || !Array.isArray(body.people) || !Array.isArray(body.categories) || !Array.isArray(body.expenses)) {
    return NextResponse.json({ error: "formato inválido" }, { status: 400 })
  }

  try {
    const doc = { ...body, updatedAt: new Date().toISOString() }
    await redis.set(key(slug), JSON.stringify(doc))
    return NextResponse.json({ ok: true, updatedAt: doc.updatedAt }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "falha ao salvar" }, { status: 500 })
  }
}
