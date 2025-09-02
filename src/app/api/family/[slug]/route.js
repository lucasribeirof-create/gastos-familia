// src/app/api/family/[slug]/route.js
export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { carregarFamilia, salvarFamilia } from "@/app/actions"

function normEmail(v) {
  return (v || "").toString().trim().toLowerCase()
}

function todayYYYYMM() {
  return new Date().toISOString().slice(0, 7)
}
function firstDayOfMonth(ym) {
  return `${ym}-01`
}

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
  }
}

/**
 * GET /api/family/[slug]
 * - Requer usuário logado (usa getServerSession() sem authOptions para evitar erro de import).
 * - Tenta carregar o doc; se falhar ou não existir, cria com o usuário como OWNER e salva.
 * - Garante que o usuário esteja como membro owner em pelo menos 1 projeto.
 */
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

    // 1) tenta carregar; se der erro, continua com doc=null
    try {
      doc = (await carregarFamilia(slug)) || null
    } catch (e) {
      console.error("carregarFamilia falhou, criando padrão:", e)
      doc = null
    }

    // 2) se não existe, cria padrão e tenta salvar
    if (!doc || typeof doc !== "object") {
      doc = makeDefaultDoc(me)
      try {
        await salvarFamilia(slug, doc)
      } catch (e) {
        console.error("salvarFamilia (primeira criação) falhou:", e)
        // mesmo que falhe persistir agora, retornamos o doc para a UI não travar
      }
      return Response.json(doc)
    }

    // 3) garante ao menos 1 projeto e me como membro owner
    let changed = false
    if (!Array.isArray(doc.projects) || doc.projects.length === 0) {
      doc = makeDefaultDoc(me)
      changed = true
    } else {
      let hasMe = false
      const fixed = doc.projects.map((p) => {
        const members = Array.isArray(p?.members) ? p.members : []
        const meIn = members.find((m) => normEmail(m?.email) === me)
        if (meIn) hasMe = true
        return { ...p, members }
      })
      if (!hasMe) {
        fixed[0] = {
          ...fixed[0],
          members: [{ email: me, role: "owner" }, ...(fixed[0].members || [])],
        }
        doc.projects = fixed
        changed = true
      } else {
        doc.projects = fixed
      }
    }

    if (changed) {
      try {
        await salvarFamilia(slug, doc)
      } catch (e) {
        console.error("salvarFamilia (ajuste de membros) falhou:", e)
      }
    }

    return Response.json(doc)
  } catch (err) {
    console.error("GET /api/family error:", err)
    return new Response(JSON.stringify({ error: "Falha ao carregar família" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

/**
 * PUT /api/family/[slug]
 * - Se houver members em qualquer projeto, apenas owner/editor podem salvar.
 * - Se não houver members, libera (migração).
 */
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
    const body = await req.json()

    const projects = Array.isArray(body?.projects) ? body.projects : []
    const anyWithMembers = projects.some(
      (p) => Array.isArray(p?.members) && p.members.length > 0
    )

    let allowed = !anyWithMembers
    if (!allowed) {
      for (const p of projects) {
        const members = Array.isArray(p?.members) ? p.members : []
        const mine = members.find((m) => normEmail(m?.email) === me)
        if (mine && (mine.role === "owner" || mine.role === "editor")) {
          allowed = true
          break
        }
      }
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Sem permissão para salvar" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    }

    await salvarFamilia(slug, body)
    return Response.json({ ok: true })
  } catch (err) {
    console.error("PUT /api/family error:", err)
    return new Response(JSON.stringify({ error: "Falha ao salvar" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}
