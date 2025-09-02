// src/app/dashboard/page.js
"use client"

export const dynamic = "force-dynamic"

import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react"
import * as NextAuth from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts"

// ---------------- utils ----------------
const currency = (v) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00")
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const isoToday = () => new Date().toISOString().slice(0,10)
const firstDayOfMonth = (ym) => `${ym}-01`

function hash36(str) { let h = 5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return (h>>>0).toString(36) }
const slugFromEmail = (email) => `fam-${hash36(String(email||"").trim().toLowerCase())}`

function ChartsErrorBoundary({ children }) {
  const [crashed, setCrashed] = useState(false)
  return crashed ? (
    <div className="h-72 grid place-items-center text-sm text-red-600">Erro nos gráficos.</div>
  ) : (
    <ErrorCatcher onError={() => setCrashed(true)}>{children}</ErrorCatcher>
  )
}
class ErrorCatcher extends React.Component {
  constructor(p){ super(p); this.state={}; }
  componentDidCatch(){ this.props.onError?.(); }
  render(){ return this.props.children }
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Carregando…</div>}>
      <Dashboard />
    </Suspense>
  )
}

export function Dashboard() {
  const useS = NextAuth?.useSession
  const sess = typeof useS === "function" ? useS() : { data: null, status: "unauthenticated" }
  const session = (sess && "data" in sess) ? sess.data : null
  const status = (sess && "status" in sess) ? sess.status : "unauthenticated"

  const router = useRouter()
  const search = useSearchParams()

  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  // state do documento
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState(["Mercado","Carro","Aluguel","Lazer"])
  const [projects, setProjects] = useState([])
  const [expenses, setExpenses] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState("")

  // filtros/UI
  const [period, setPeriod] = useState(todayYYYYMM())
  const [onlyCategory, setOnlyCategory] = useState("")
  const [onlyPerson, setOnlyPerson] = useState("")
  const [orderMode, setOrderMode] = useState("cat")
  const [chartType, setChartType] = useState("pizza")

  // inputs de gasto
  const [date, setDate] = useState(isoToday())
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")

  // convite
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")

  const myEmail = (session?.user?.email || "").toLowerCase()
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])
  const myRole = useMemo(() => {
    if (!selectedProject) return "none"
    const members = Array.isArray(selectedProject.members) ? selectedProject.members : []
    const me = members.find(m => (m?.email || "").toLowerCase() === myEmail)
    return me?.role || (members.length === 0 ? "owner" : "none")
  }, [selectedProject, myEmail])
  const readOnly = !(myRole === "owner" || myRole === "editor")

  // -------- carregamento inicial via API -------
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/dashboard")
      return
    }
    if (status !== "authenticated") return

    const famParam = search?.get("fam")
    const email = (session?.user?.email) || ""
    const computedSlug = famParam || slugFromEmail(email)

    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/family/${computedSlug}`, { cache: "no-store" })
        if (!res.ok) throw new Error(await res.text())
        const doc = await res.json()

        setSlug(computedSlug)
        setPeople(Array.isArray(doc.people) ? doc.people : [])
        setCategories(Array.isArray(doc.categories) ? doc.categories : [])
        const projs = Array.isArray(doc.projects) ? doc.projects.map(p => ({ ...p, members: Array.isArray(p.members) ? p.members : [] })) : []
        setProjects(projs)
        setExpenses(Array.isArray(doc.expenses) ? doc.expenses : [])

        const firstId = projs[0]?.id || ""
        setSelectedProjectId(firstId)
        setPeriod(todayYYYYMM())
      } catch (e) {
        console.error(e)
        setError("Falha ao carregar seus dados.")
      } finally {
        setLoading(false)
      }
    })()
  }, [status, session, router, search])

  // -------- salvar pelo backend (PUT) --------
  const saveDoc = useCallback(async (next) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/family/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) {
        let msg = "Falha ao salvar."
        try {
          const j = await res.json()
          if (j?.error || j?.message) {
            msg = `${j.error || "Erro"}${j.message ? ` – ${j.message}` : ""}`
          }
        } catch {}
        throw new Error(msg)
      }
    } catch (e) {
      console.error(e)
      setError(String(e.message || e))
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }, [slug])

  const setDocAndSave = useCallback((fn) => {
    if (readOnly) { alert("Somente leitura para seu papel."); return }
    const next = fn({ people, categories, projects, expenses })
    setPeople(next.people); setCategories(next.categories); setProjects(next.projects); setExpenses(next.expenses)
    saveDoc(next)
  }, [people, categories, projects, expenses, readOnly, saveDoc])

  // ------- helpers de edição -------
  function addPersonLocal(name){ const n=(name||"").trim(); if(!n||people.includes(n))return; setDocAndSave(d=>({ ...d, people:[...d.people, n] })) }
  function addCategoryLocal(name){ const n=(name||"").trim(); if(!n||categories.includes(n))return; setDocAndSave(d=>({ ...d, categories:[...d.categories, n] })) }
  function addMember(){
    const email=(inviteEmail||"").trim().toLowerCase(); if(!email||!selectedProject) return
    setDocAndSave(d=>{
      d.projects = d.projects.map(p=>{
        if(p.id!==selectedProject.id) return p
        const members = Array.isArray(p.members) ? p.members : []
        if (members.some(m => (m.email||"").toLowerCase() === email)) return p
        return { ...p, members: [...members, { email, role: inviteRole }] }
      })
      return d
    })
    setInviteEmail("")
  }
  function addExpense(){
    if (!selectedProject) { alert("Selecione/Crie um projeto."); return }
    const value = Number(String(amount).replace(",", "."))
    if (!who || !category || !Number.isFinite(value) || value<=0 || !date) return
    const e = { id: "exp-"+Math.random().toString(36).slice(2,9), who, category, amount: value, desc: (desc||"").trim(), date, projectId: selectedProjectId }
    setDocAndSave(d=>({ ...d, expenses:[...d.expenses, e] }))
    setWho(""); setCategory(""); setAmount(""); setDesc("")
  }
  function removeExpense(id){ setDocAndSave(d=>({ ...d, expenses: d.expenses.filter(e=>e.id!==id) })) }

  // ------- derivados para UI -------
  const projectExpenses = useMemo(()=>expenses.filter(e=>e.projectId===selectedProjectId),[expenses,selectedProjectId])
  const months = useMemo(()=>{ const set=new Set(projectExpenses.map(e=>monthKey(e.date))); return ["ALL", ...[...set].filter(Boolean).sort()] },[projectExpenses])
  const filtered = useMemo(()=>projectExpenses
    .filter(e => (period==="ALL"||monthKey(e.date)===period))
    .filter(e => (onlyCategory?e.category===onlyCategory:true))
    .filter(e => (onlyPerson?e.who===onlyPerson:true))
  ,[projectExpenses,period,onlyCategory,onlyPerson])
  const filteredAsc=[...filtered].sort((a,b)=>a.date.localeCompare(b.date))
  const filteredDesc=[...filtered].sort((a,b)=>b.date.localeCompare(a.date))
  const groupedByCategory = useMemo(()=>{
    const m=new Map(); filteredAsc.forEach(e=>{ const arr=m.get(e.category)||[]; arr.push(e); m.set(e.category,arr) })
    return [...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  },[filteredAsc])
  const total = useMemo(()=>filtered.reduce((s,e)=>s+(e.amount||0),0),[filtered])
  const byCategory = useMemo(()=>{
    const m=new Map(); filtered.forEach(e=>m.set(e.category,(m.get(e.category)||0)+(e.amount||0)))
    return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  },[filtered])
  const byPerson = useMemo(()=>{
    const m=new Map(); filtered.forEach(e=>m.set(e.who,(m.get(e.who)||0)+(e.amount||0)))
    return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  },[filtered])
  const monthlySeries = useMemo(()=>{
    const m=new Map(); projectExpenses.forEach(e=>{ const k=monthKey(e.date); m.set(k,(m.get(k)||0)+(e.amount||0)) })
    const arr=[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,total])=>({month,total}))
    for(let i=0;i<arr.length;i++){
      const w=arr.slice(Math.max(0,i-2),i+1).map(x=>x.total)
      arr[i].mm3=w.length?(w.reduce((a,b)=>a+b,0)/w.length):arr[i].total
    }
    return arr
  },[projectExpenses])

  if (status !== "authenticated") return <div className="p-6">Redirecionando…</div>
  if (loading) return <div className="p-6">Carregando dados…</div>

  const card = "rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
  const shareLink = typeof window!=="undefined" ? `${window.location.origin}/dashboard?fam=${slug}` : `/dashboard?fam=${slug}`

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gastos em Família</h1>
          <p className="text-xs opacity-70">Projeto: <b>{(projects.find(p=>p.id===selectedProjectId)?.name)||"—"}</b> · Seu papel: <b>{(selectedProject && (Array.isArray(selectedProject.members)?selectedProject.members:[]).find(m => (m?.email||"").toLowerCase()===myEmail)?.role) || "owner"}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>NextAuth.signOut({ callbackUrl: "/" })} className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Sair</button>
        </div>
      </div>

      {/* Compartilhar + Projeto */}
      <div className={`mt-4 p-3 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">Projeto:</label>
          <select className="px-3 py-2 rounded-xl border dark:border-slate-700 dark:bg-slate-900"
                  value={selectedProjectId}
                  onChange={e=>setSelectedProjectId(e.target.value)}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} {p.status==="closed"?"(fechado)":""}</option>)}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Compartilhar com pessoas</div>
            <div className="flex gap-2">
              <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="email@dominio.com"
                     value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
              <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={addMember}>Adicionar</button>
            </div>
            <div className="mt-3 text-xs opacity-70">Envie manualmente o link do projeto (abaixo). O convidado deve fazer login com o mesmo e-mail.</div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Link do projeto</div>
            <div className="flex gap-2">
              <input readOnly className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" value={shareLink} />
              <button className="px-4 py-2 rounded-xl border" onClick={()=>navigator.clipboard?.writeText(shareLink)}>Copiar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Pessoas/Categorias */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">1) Pessoas do grupo</h3>
          <div className="flex gap-2">
            <input id="newPerson" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nome (ex.: Ana)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={()=>{
                const el=document.getElementById("newPerson"); const v=(el?.value||"").trim(); if(v) addPersonLocal(v); if(el) el.value=""
              }}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map(p => (
              <span key={p} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border dark:border-slate-700">{p}</span>
            ))}
          </div>
        </div>

        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">2) Categorias</h3>
          <div className="flex gap-2">
            <input id="newCat" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nova categoria (ex.: Remédios)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={()=>{
                const el=document.getElementById("newCat"); const v=(el?.value||"").trim(); if(v) addCategoryLocal(v); if(el) el.value=""
              }}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border dark:border-slate-700">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Adicionar gasto */}
      <div className={`mt-4 p-3 ${card}`}>
        <h3 className="font-semibold mb-3">3) Adicionar gasto</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input type="date" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={date} onChange={e=>setDate(e.target.value)} />
          <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={who} onChange={e=>setWho(e.target.value)}>
            <option value="">Quem pagou?</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">Categoria</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 md:col-span-2" placeholder="Descrição" value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addExpense() }}} />
          <div className="flex gap-2">
            <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addExpense() }}} />
            <button disabled={readOnly} onClick={addExpense} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap disabled:opacity-50">Lançar</button>
          </div>
        </div>
      </div>

      {/* Filtros / Lista / Resumos / Gráficos (mesmo de antes) */}
      <div className="mt-6 font-semibold text-lg">Despesas</div>

      {/* … (resto igual à sua versão anterior que já está funcionando) … */}

      <div className="mt-6 text-xs">
        {saving ? <span className="opacity-70">Salvando…</span> : error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
