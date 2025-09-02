// src/app/api/family/[slug]/route.js
import { NextResponse } from "next/server"
import Redis from "ioredis"
import { getToken } from "next-auth/jwt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ---- Redis inline ----
const url = process.env.REDIS_URL
if (!url) console.warn("[WARN] REDIS_URL não definido.")
const redis = new Redis(url, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: false,
  tls: url?.startsWith("rediss://") ? {} : undefined,
})

const KEY = (slug) => `family:${slug}`

function normalizeDoc(raw) {
  const doc = raw && typeof raw === "object" ? raw : {}
  return {
    people: Array.isArray(doc.people) ? doc.people : [],
    categories: Array.isArray(doc.categories) ? doc.categories : [],
    projects: Array.isArray(doc.projects) ? doc.projects : [],
    expenses: Array.isArray(doc.expenses) ? doc.expenses : [],
  }
}

// ---- Util: pega e-mail do usuário logado via NextAuth JWT ----
async function getUserEmail(req) {
  // precisa de NEXTAUTH_SECRET configurado
  const token = await getToken({ req }) // funciona com NextRequest
  return token?.email || null
}

// ---- Leitura: liberada (só carrega o doc) ----
export async function GET(_req, { params }) {
  try {
    const { slug } = params
    const raw = await redis.get(KEY(slug))
    const doc = raw ? JSON.parse(raw) : { people: [], categories: [], projects: [], expenses: [] }
    return NextResponse.json(normalizeDoc(doc))
  } catch (e) {
    console.error("GET /api/family error:", e)
    return NextResponse.json({ error: "Falha ao carregar dados" }, { status: 500 })
  }
}

/**
 * PUT com autorização:
 * - Busca o documento atual no Redis.
 * - Checa se o usuário logado está em "projects[].members" como owner/editor.
 * - Se não houver doc (primeira gravação): permite e define o autor como owner do 1º projeto.
 * - Se só for viewer (ou não membro): 403.
 * - Salva SEMPRE o documento normalizado.
 */
export async function PUT(req, { params }) {
  try {
    const { slug } = params
    const body = await req.json().catch(() => ({}))
    let incoming = normalizeDoc(body)

    const email = await getUserEmail(req)
    if (!email) {
      // Sem sessão válida → bloquear escrita
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Documento atual (base de verdade para checar membros)
    const raw = await redis.get(KEY(slug))
    const current = raw ? normalizeDoc(JSON.parse(raw)) : null

    // Helper: retorna o "papel" do usuário no doc atual (owner/editor/viewer/none)
    const roleFromCurrent = (() => {
      if (!current || !Array.isArray(current.projects)) return "none"
      for (const p of current.projects) {
        const members = Array.isArray(p.members) ? p.members : []
        const me = members.find(m => (m?.email || "").toLowerCase() === email.toLowerCase())
        if (me?.role) return String(me.role)
      }
      return "none"
    })()

    if (!current) {
      // Primeira gravação deste slug: permite e garante ownership ao autor.
      // Se não existir projeto, cria um "Projeto".
      if (!incoming.projects.length) {
        incoming.projects = [{
          id: "proj-"+Math.random().toString(36).slice(2,8),
          name: "Projeto",
          type: "monthly",
          start: null,
          end: "",
          status: "open",
          members: [{ email, role: "owner" }],
        }]
      } else {
        // Garante array members no 1º projeto e coloca o autor como owner se faltar
        const p0 = incoming.projects[0]
        p0.members = Array.isArray(p0.members) ? p0.members : []
        if (!p0.members.some(m => (m?.email || "").toLowerCase() === email.toLowerCase())) {
          p0.members.push({ email, role: "owner" })
        }
      }
    } else {
      // Já existe doc → só permite se eu sou owner/editor em ALGUM projeto do doc atual
      if (roleFromCurrent !== "owner" && roleFromCurrent !== "editor") {
        return NextResponse.json({ error: "Sem permissão para editar (não é membro ou é viewer)" }, { status: 403 })
      }
      // Segurança: nunca aceite que o cliente remova todos os owners
      // (se o cliente mandar um doc sem owners, preserva owners do doc atual)
      const currentOwners = new Set()
      for (const p of current.projects) {
        for (const m of (p.members || [])) {
          if (m.role === "owner") currentOwners.add((m.email || "").toLowerCase())
        }
      }
      const incomingOwners = new Set()
      for (const p of incoming.projects) {
        for (const m of (Array.isArray(p.members) ? p.members : [])) {
          if (m.role === "owner") incomingOwners.add((m.email || "").toLowerCase())
        }
      }
      if (currentOwners.size && ![...currentOwners].some(o => incomingOwners.has(o))) {
        // preserva owners do documento atual no primeiro projeto
        if (!incoming.projects.length) incoming.projects = current.projects
        const p0 = incoming.projects[0]
        p0.members = Array.isArray(p0.members) ? p0.members : []
        currentOwners.forEach(o => {
          if (!p0.members.some(m => (m.email || "").toLowerCase() === o)) {
            p0.members.push({ email: o, role: "owner" })
          }
        })
      }
    }

    // Salva
    await redis.set(KEY(slug), JSON.stringify(incoming))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("PUT /api/family error:", e)
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 })
  }
}
