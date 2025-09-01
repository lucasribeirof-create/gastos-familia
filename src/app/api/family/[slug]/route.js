// src/app/api/family/[slug]/route.js
import { NextResponse } from "next/server"
import Redis from "ioredis"
import { getToken } from "next-auth/jwt"
import { randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Conexão Redis (usa REDIS_URL da Vercel)
const redis = new Redis(process.env.REDIS_URL)

const key = (slug) => `family:${slug}`

function makeDefaultProject() {
  return {
    id: `proj-${randomUUID()}`,
    name: "Geral",
    type: "general",      // "monthly" | "trip" | "custom" etc.
    start: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    end: null,
    status: "open",       // "open" | "closed"
  }
}

function makeDefaultDoc() {
  const createdAt = new Date().toISOString()
  return {
    people: [],
    categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
    projects: [makeDefaultProject()],
    expenses: [], // { id, who, category, amount, desc, date, projectId }
    createdAt,
    updatedAt: createdAt,
  }
}

/**
 * Migra documentos antigos (sem "projects" e/ou sem "projectId" nas despesas)
 * - Se não houver projects, cria um "Geral"
 * - Qualquer despesa sem projectId recebe o id do projeto padrão/aberto
 * - Garante createdAt/updatedAt
 */
function migrateDocShape(doc) {
  let migrated = false

  if (!doc || typeof doc !== "object") {
    return { doc: makeDefaultDoc(), migrated: true }
  }

  if (!Array.isArray(doc.people)) doc.people = []
  if (!Array.isArray(doc.categories)) doc.categories = ["Mercado", "Carro", "Aluguel", "Lazer"]
  if (!Array.isArray(doc.expenses)) doc.expenses = []

  if (!Array.isArray(doc.projects) || doc.projects.length === 0) {
    doc.projects = [makeDefaultProject()]
    migrated = true
  }

  const openProject = doc.projects.find(p => p?.status === "open") || doc.projects[0]
  const projectId = openProject?.id || makeDefaultProject().id

  // Garante projectId nas despesas
  for (const e of doc.expenses) {
    if (!e.projectId) {
      e.projectId = projectId
      migrated = true
    }
  }

  if (!doc.createdAt) {
    doc.createdAt = new Date().toISOString()
    migrated = true
  }
  if (!doc.updatedAt) {
    doc.updatedAt = new Date().toISOString()
    migrated = true
  }

  return { doc, migrated }
}

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
    const k = key(slug)
    const raw = await redis.get(k)

    if (!raw) {
      // primeira vez: cria documento padrão com "projects"
      const doc = makeDefaultDoc()
      await redis.set(k, JSON.stringify(doc))
      return NextResponse.json(doc, { status: 200 })
    }

    const parsed = JSON.parse(raw)
    const { doc, migrated } = migrateDocShape(parsed)

    if (migrated) {
      // atualiza updatedAt e persiste migração
      doc.updatedAt = new Date().toISOString()
      await redis.set(k, JSON.stringify(doc))
    }

    return NextResponse.json(doc, { status: 200 })
  } catch (e) {
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

  // Validação mínima de tipos/arrays
  if (!body || !Array.isArray(body.people) || !Array.isArray(body.categories) || !Array.isArray(body.expenses)) {
    return NextResponse.json({ error: "formato inválido" }, { status: 400 })
  }

  // Projects é obrigatório a partir de agora (mas criamos se vier faltando)
  if (!Array.isArray(body.projects) || body.projects.length === 0) {
    body.projects = [makeDefaultProject()]
  }

  // Garante que toda despesa aponte para um projectId existente
  const projectIds = new Set(body.projects.map(p => p?.id).filter(Boolean))
  const openProject = body.projects.find(p => p?.status === "open") || body.projects[0]
  const fallbackProjectId = openProject?.id

  body.expenses = body.expenses.map(e => {
    if (!e.projectId || !projectIds.has(e.projectId)) {
      return { ...e, projectId: fallbackProjectId }
    }
    return e
  })

  // Atualiza timestamps
  const now = new Date().toISOString()
  const k = key(slug)

  // Preserva createdAt se já existir
  try {
    const prevRaw = await redis.get(k)
    if (prevRaw) {
      const prev = JSON.parse(prevRaw)
      if (prev?.createdAt && !body.createdAt) {
        body.createdAt = prev.createdAt
      }
    }
  } catch {
    // ignora erro ao ler anterior
  }

  const docToSave = {
    people: body.people,
    categories: body.categories,
    projects: body.projects,
    expenses: body.expenses,
    createdAt: body.createdAt || now,
    updatedAt: now,
  }

  try {
    await redis.set(k, JSON.stringify(docToSave))
    return NextResponse.json({ ok: true, updatedAt: docToSave.updatedAt }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: "falha ao salvar" }, { status: 500 })
  }
}
