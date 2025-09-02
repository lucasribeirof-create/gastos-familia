// src/app/api/family/[slug]/route.js
export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { carregarFamilia, salvarFamilia } from "@/app/actions"

// ---------- helpers ----------
const normEmail = (v) => (v || "").toString().trim().toLowerCase()
const todayYYYYMM = () => new Date().toISOString().slice(0, 7)
const firstDayOfMonth = (ym) => `${ym}-01`

function makeDefaultDoc(ownerEmail) {
  const pid = "proj-" + Math.random().toString(36).slice(2, 8)
  return {
    people: [],
    categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
    projects: [
      {
        id: pid,
        name: "Geral",
        type: "monthly",
        start: firstDayOfMonth(todayYYYYMM()),
        end: "",
        status: "open",
        members: [{ email: ownerEmail, role: "owner" }],
      },
    ],
    expenses: [],
    updatedAt: new Date().toISOString(),
  }
}

function sanitizeDoc(doc) {
  const safe = doc && typeof doc === "object" ? doc : {}
  const people = Array.isArray(safe.people) ? safe.people : []
  const categories = Array.isArray(safe.categories) ? safe.categories : []
  let projects = Array.isArray(safe.projects) ? safe.projects : []
  const expenses = Array.isArray(safe.expenses) ? safe.expenses : []

  projects = projects.map((p) => ({
    id: p?.id || "proj-" + Math.random().toString(36).slice(2, 8),
    name: String(p?.name || "Projeto"),
    type: p?.type || "custom",
    start: p?.start || firstDayOfMonth(todayYYYYMM()),
    end: p?.end || "",
    status: p?.status || "open",
    members: Array.isArray(p?.members) ? p.members : [],
  }))

  return { people, categories, projects, expenses }
}

function hasWriteAccess(projects, email) {
  for (const p of projects) {
    const members = Array.isArray(p?.members) ? p.members : []
    const me = members.find((m) => normEmail(m?.email) === normEmail(email))
    if (me && (me.role === "owner" || me.role === "editor")) return true
  }
  return false
}

// ---------- GET ----------
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession().catch(() => null)
    const me = normEmail(session?.user?.email)
    if (!me) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const { slug } = params || {}
    let doc = null

    try {
      doc = (await carregarFamilia(slug)) || null
    } catch (e) {
      console.error("[GET] carregarFamilia falhou:", e)
      doc = null
    }

    if (!doc || typeof doc !== "object") {
      // cria doc padrão com me como owner
      doc = makeDefaultDoc(me)
      try {
        await salvarFamilia(slug, { ...doc, slug })
      } catch (e) {
        console.error("[GET] salvarFamilia (criação) falhou:", e)
      }
      return Response.json(doc)
    }

    // saneia estrutura
    const base = sanitizeDoc(doc)

    // garante que exista ao menos um projeto
    if (base.projects.length === 0) {
      const created = makeDefaultDoc(me)
      try {
        await salvarFamilia(slug, { ...created, slug })
      } catch (e) {
        console.error("[GET] salvarFamilia (fallback sem projetos) falhou:", e)
      }
      return Response.json(created)
    }

    // garante que o usuário esteja como membro (owner) em algum projeto
    let isMember = false
    const fixed = base.projects.map((p) => {
      const members = Array.isArray(p?.members) ? p.members : []
      const meIn = members.find((m) => normEmail(m?.email) === me)
      if (meIn) isMember = true
      return { ...p, members }
    })
    let finalDoc = { ...base, projects: fixed, updatedAt: new Date().toISOString() }
    if (!isMember) {
      finalDoc.projects[0] = {
        ...finalDoc.projects[0],
        members: [{ email: me, role: "owner" }, ...(finalDoc.projects[0].members || [])],
      }
      try {
        await salvarFamilia(slug, { ...finalDoc, slug })
      } catch (e) {
        console.error("[GET] salvarFamilia (injeta owner) falhou:", e)
      }
    }

    return Response.json(finalDoc)
  } catch (err) {
    console.error("GET /api/family error (fatal):", err)
    return new Response(JSON.stringify({ error: "Falha ao carregar família" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

// ---------- PUT ----------
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession().catch(() => null)
    const me = normEmail(session?.user?.email)
    if (!me) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const { slug } = params || {}
    let body
    try {
      body = await req.json()
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    // saneia a estrutura recebida
    const base = sanitizeDoc(body)

    // regra de autorização:
    // - se não houver members em nenhum projeto => libera (migração)
    // - se houver, precisa ser owner/editor em ALGUM projeto
    const anyWithMembers = base.projects.some(
      (p) => Array.isArray(p?.members) && p.members.length > 0
    )
    if (anyWithMembers && !hasWriteAccess(base.projects, me)) {
      return new Response(JSON.stringify({ error: "Sem permissão para salvar" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    }

    // metadados úteis
    const toSave = {
      ...base,
      slug,
      updatedAt: new Date().toISOString(),
    }

    try {
      await salvarFamilia(slug, toSave)
    } catch (e) {
      // Aqui está o ponto que estava dando 500 — vamos devolver
      // a mensagem real para você ver o motivo (ex.: credenciais/Redis/Google).
      console.error("[PUT] salvarFamilia falhou:", e)
      const hint =
        "Verifique as variáveis de ambiente usadas por salvarFamilia (ex.: REDIS_URL / credenciais Google) e o shape do documento."
      return new Response(
        JSON.stringify({
          error: "Falha ao salvar",
          message: String(e?.message || e),
          hint,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      )
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error("PUT /api/family error (fatal):", err)
    return new Response(JSON.stringify({ error: "Falha ao salvar" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}
