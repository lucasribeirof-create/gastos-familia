// /src/app/api/family/[slug]/route.js
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import Redis from "ioredis"
import { canEditProject, canManageMembers } from "@/utils/authz"

const redis = new Redis(process.env.REDIS_URL)
const key = (slug) => `family:${slug}`

function nowISO(){ return new Date().toISOString() }

// === Migração de schema ===
// - Converte categories: string[] -> {id,name,color,parentId?,order}
// - Garante project.owner e project.members
// - Garante campos base
function hashId(s){
  // hash leve estável p/ id/cores; evita colidir com ids existentes que não são hash
  let h = 2166136261>>>0
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return "id_"+(h>>>0).toString(36)
}
function colorForId(id){
  // cor HSL estável baseada no id (0..360)
  let h = 0
  for (let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) % 360 }
  return `hsl(${h} 70% 48%)`
}

function migrateDocShape(doc, currentUserEmail) {
  const d = doc && typeof doc === "object" ? structuredClone(doc) : {}

  d.people = Array.isArray(d.people) ? d.people : []
  // categories
  if (Array.isArray(d.categories)) {
    if (d.categories.length && typeof d.categories[0] === "string") {
      d.categories = d.categories.map((name, idx) => {
        const id = hashId("cat:"+name)
        return { id, name, color: colorForId(id), order: idx }
      })
    } else {
      // normaliza cores e orders
      d.categories = d.categories.map((c, idx) => ({
        id: c.id || hashId("cat_old:"+c.name),
        name: c.name,
        color: c.color || colorForId(c.id || hashId("cat_old:"+c.name)),
        parentId: c.parentId || null,
        order: typeof c.order === "number" ? c.order : idx
      }))
    }
  } else {
    d.categories = []
  }

  d.projects = Array.isArray(d.projects) ? d.projects : []
  // cria 1 projeto default se não houver
  if (d.projects.length === 0) {
    const pid = hashId("proj:default")
    d.projects.push({
      id: pid, name: "Projeto", start: null, end: null, status: "open",
      owner: currentUserEmail || null, members: []
    })
  } else {
    d.projects = d.projects.map(p => ({
      ...p,
      owner: p.owner || currentUserEmail || null,
      members: Array.isArray(p.members) ? p.members : []
    }))
  }

  d.expenses = Array.isArray(d.expenses) ? d.expenses : []
  d.createdAt = d.createdAt || nowISO()
  d.updatedAt = nowISO()
  return d
}

// Aplica patch restrito ao projeto ativo (para PUT)
function applyPatch(oldDoc, patch, userEmail) {
  const activeProjectId = patch?.activeProjectId
  const project = (oldDoc.projects || []).find(p => p.id === activeProjectId)
  if (!project) throw new Error("Projeto ativo não encontrado")

  // 1) MEMBERS: só owner pode alterar
  if (Array.isArray(patch.members)) {
    if (!canManageMembers(userEmail, project)) throw new Error("Sem permissão para gerenciar membros")
    project.members = patch.members
  }

  // 2) PROJECT fields (básicos): editor+
  if (patch.projectUpdate) {
    if (!canEditProject(userEmail, project)) throw new Error("Sem permissão para editar projeto")
    const allowed = ["name","start","end","status"] // owner não é editável aqui
    for (const k of allowed) {
      if (k in patch.projectUpdate) project[k] = patch.projectUpdate[k]
    }
  }

  // 3) CATEGORIES (globais): editor+
  if (Array.isArray(patch.categories)) {
    if (!canEditProject(userEmail, project)) throw new Error("Sem permissão para editar categorias")
    // normaliza/ordena
    oldDoc.categories = patch.categories.map((c, idx) => ({
      id: c.id || hashId("cat:"+c.name),
      name: c.name,
      color: c.color || colorForId(c.id || hashId("cat:"+c.name)),
      parentId: c.parentId || null,
      order: typeof c.order === "number" ? c.order : idx
    }))
  }

  // 4) EXPENSES do projeto ativo: editor+
  if (Array.isArray(patch.expenses)) {
    if (!canEditProject(userEmail, project)) throw new Error("Sem permissão para editar despesas")
    const others = (oldDoc.expenses || []).filter(e => e.projectId !== activeProjectId)
    const sanitized = patch.expenses.map(e => ({
      id: e.id || hashId("exp:"+Math.random().toString(36).slice(2)),
      who: e.who, category: e.category, amount: Number(e.amount)||0,
      desc: e.desc || "", date: e.date, projectId: activeProjectId
    }))
    oldDoc.expenses = [...others, ...sanitized]
  }

  oldDoc.updatedAt = nowISO()
  return oldDoc
}

export async function GET(req, { params }) {
  const token = await getToken({ req })
  const userEmail = token?.email || null
  const { slug } = params
  const raw = await redis.get(key(slug))
  if (!raw) {
    // cria doc vazio migrado
    const base = migrateDocShape({}, userEmail)
    await redis.set(key(slug), JSON.stringify(base))
    return NextResponse.json(base)
  }
  let doc = JSON.parse(raw || "{}")
  doc = migrateDocShape(doc, userEmail)
  // persiste migração se mudou
  await redis.set(key(slug), JSON.stringify(doc))
  return NextResponse.json(doc)
}

export async function PUT(req, { params }) {
  const token = await getToken({ req })
  if (!token?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const userEmail = token.email
  const { slug } = params
  const patch = await req.json()

  const raw = await redis.get(key(slug))
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 })
  let doc = migrateDocShape(JSON.parse(raw), userEmail)

  try {
    doc = applyPatch(structuredClone(doc), patch, userEmail)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }

  await redis.set(key(slug), JSON.stringify(doc))
  return NextResponse.json({ ok: true })
}
