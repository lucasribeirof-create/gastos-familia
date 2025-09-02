// src/app/api/family/[slug]/route.js
export const dynamic = "force-dynamic"

import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { carregarFamilia, salvarFamilia } from "@/app/actions"

function normEmail(v) {
  return (v || "").toString().trim().toLowerCase()
}

/**
 * GET: retorna o documento completo da família (slug)
 */
export async function GET(_req, { params }) {
  try {
    const { slug } = params || {}
    const doc = (await carregarFamilia(slug)) || {}
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
 * PUT: salva o documento da família com autorização simples
 * Regras:
 * - Se NENHUM projeto tiver members definidos => permite salvar (migração de dados antigos)
 * - Se houver members em QUALQUER projeto => o e-mail logado precisa estar em ALGUM projeto como owner/editor
 * - viewer NÃO pode salvar
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

    // Estrutura esperada do doc completo
    const projects = Array.isArray(body?.projects) ? body.projects : []

    // Há pelo menos um projeto com members?
    const anyWithMembers = projects.some(
      (p) => Array.isArray(p?.members) && p.members.length > 0
    )

    // Se NÃO houver members em nenhum projeto => liberar (migração / primeiro save)
    let allowed = !anyWithMembers

    // Se houver members, liberar somente se me ∈ (owner|editor) em algum projeto
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
