// src/app/api/family/[slug]/route.js
import { NextResponse } from "next/server"
import { redis } from "@/utils/db"   // usa alias @ => ./src/utils/db

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

export async function PUT(req, { params }) {
  try {
    const { slug } = params
    const body = await req.json().catch(() => ({}))
    const doc = normalizeDoc(body)
    await redis.set(KEY(slug), JSON.stringify(doc))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("PUT /api/family error:", e)
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 })
  }
}
