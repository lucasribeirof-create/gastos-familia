// /src/app/api/family/[slug]/projects/[projectId]/members/route.js
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import Redis from "ioredis"
import { canManageMembers } from "@/utils/authz"

const redis = new Redis(process.env.REDIS_URL)
const key = (slug) => `family:${slug}`

function nowISO(){ return new Date().toISOString() }

export async function POST(req, { params }) {
  // Add member
  const token = await getToken({ req })
  if (!token?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug, projectId } = params
  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 })

  const raw = await redis.get(key(slug))
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const doc = JSON.parse(raw)
  const project = (doc.projects || []).find(p => p.id === projectId)
  if (!project) return NextResponse.json({ error: "proj_not_found" }, { status: 404 })

  if (!canManageMembers(token.email, project)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  project.members = project.members || []
  if (!project.members.find(m => m.email === email)) {
    project.members.push({ email, role: role || "viewer" })
  }
  doc.updatedAt = nowISO()
  await redis.set(key(slug), JSON.stringify(doc))
  return NextResponse.json({ ok: true })
}

export async function PATCH(req, { params }) {
  // Change role
  const token = await getToken({ req })
  if (!token?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug, projectId } = params
  const { email, role } = await req.json()
  if (!email || !role) return NextResponse.json({ error: "email_role_required" }, { status: 400 })

  const raw = await redis.get(key(slug))
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const doc = JSON.parse(raw)
  const project = (doc.projects || []).find(p => p.id === projectId)
  if (!project) return NextResponse.json({ error: "proj_not_found" }, { status: 404 })

  if (!canManageMembers(token.email, project)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const m = (project.members || []).find(x => x.email === email)
  if (m) m.role = role
  doc.updatedAt = nowISO()
  await redis.set(key(slug), JSON.stringify(doc))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  // Remove member
  const token = await getToken({ req })
  if (!token?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { slug, projectId } = params
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 })

  const raw = await redis.get(key(slug))
  if (!raw) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const doc = JSON.parse(raw)
  const project = (doc.projects || []).find(p => p.id === projectId)
  if (!project) return NextResponse.json({ error: "proj_not_found" }, { status: 404 })

  if (!canManageMembers(token.email, project)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  project.members = (project.members || []).filter(m => m.email !== email)
  doc.updatedAt = nowISO()
  await redis.set(key(slug), JSON.stringify(doc))
  return NextResponse.json({ ok: true })
}
