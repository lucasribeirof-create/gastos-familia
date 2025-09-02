// src/app/api/family/[slug]/route.js
export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
// ⚠️ Caminho corrigido: de "../../auth/..." para "../auth/..."
import { authOptions } from "../auth/[...nextauth]/route"
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
 * - Requer usuário logado.
 * - Se não existir doc, cria com o usuário como OWNER, salva e retorna.
 */
export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions).catch(() => null)
    const me = normEmail(session?.user?.email)
    if (!me) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const { slug } = params || {}
    let doc = (await carregarFamilia(slug)) || null

    if (!doc || typeof doc !== "object") {
      doc = makeDefaultDoc(me)
      await salvarFamilia(slug, doc)
    } else {
      // garante ao menos um projeto e o usuário membro (owner)
      if (!Array.isArray(doc.projects) || doc.projects.length === 0) {
        doc = makeDefaultDoc(me)
        await salvarFamilia(slug, doc)
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
          await salvarFamilia(slug, doc)
        } else {
          doc.projects = fixed
        }
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
 * - Se houver members, só owner/editor salvam.
 * - Se não houver members em nenhum projeto, libera (migração).
 */
export async function PUT(req, { params }) {
  try {
    const { slug } = params || {}
    const session = await getServerSession(authOptions).catch(() => null)
    const me = normEmail(session?.user?.email)

    if (!me) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

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
