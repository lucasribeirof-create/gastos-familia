"use client"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as NextAuth from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts"

// utils
const currency = (v) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00")
const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) } catch { return "" } }
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const isoToday = () => new Date().toISOString().slice(0,10)
const firstDayOfMonth = (ym) => `${ym}-01`
const randId = (p) => (p||"id")+"-"+Math.random().toString(36).slice(2,9)
function hash36(str) { let h = 5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)+str.charCodeAt(i); return (h>>>0).toString(36) }
const slugFromEmail = (email) => `fam-${hash36(String(email||"").trim().toLowerCase())}`

class ChartsErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={hasError:false} }
  static getDerivedStateFromError(){ return {hasError:true} }
  componentDidCatch(e,i){ console.error("Charts crashed:", e, i) }
  render(){ return this.state.hasError ? <div className="h-72 grid place-items-center text-sm text-red-600">Erro nos gráficos.</div> : this.props.children }
}

export default function Page() {
  const sess = NextAuth?.useSession ? NextAuth.useSession() : { data: null, status: "unauthenticated" }
  const { data: session, status } = sess
  const router = useRouter()
  const search = useSearchParams()

  const [theme, setTheme] = useState(typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light")
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  const [slug, setSlug] = useState("")
  const [period, setPeriod] = useState(todayYYYYMM())
  const [onlyCategory, setOnlyCategory] = useState("")
  const [onlyPerson, setOnlyPerson] = useState("")
  const [orderMode, setOrderMode] = useState("cat")
  const [chartType, setChartType] = useState("pizza")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState(["Mercado","Carro","Aluguel","Lazer"])
  const [projects, setProjects] = useState([])
  const [expenses, setExpenses] = useState([])

  const [selectedProjectId, setSelectedProjectId] = useState("")
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectType, setNewProjectType] = useState("monthly")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectStart, setNewProjectStart] = useState(firstDayOfMonth(todayYYYYMM()))
  const [newProjectEnd, setNewProjectEnd] = useState("")

  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(isoToday())

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("editor")

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/api/auth/signin"); return }
    if (status !== "authenticated") return

    const linkFam = search?.get("fam")
    const email = session?.user?.email || ""
    const autoSlug = slugFromEmail(email)
    const savedSlug = (linkFam || localStorage.getItem("family:slug") || autoSlug)
    if (linkFam) localStorage.setItem("family:slug", linkFam)

    ;(async () => {
      setError("")
      try {
        const fromCloud = await carregarFamilia(savedSlug)
        const doc = fromCloud || {}

        const nextPeople = Array.isArray(doc.people) ? doc.people : []
        let nextCategories = Array.isArray(doc.categories) ? doc.categories : []
        let idToName = new Map()
        if (nextCategories.length && typeof nextCategories[0] === "object") {
          nextCategories.forEach(c => { if (c && c.id && c.name) idToName.set(c.id, c.name) })
          nextCategories = nextCategories.map(c => c?.name).filter(Boolean)
        }

        let nextProjects = Array.isArray(doc.projects) ? doc.projects : []
        if (nextProjects.length === 0) {
          nextProjects = [{
            id: "proj-"+Math.random().toString(36).slice(2,8),
            name: "Projeto",
            type: "monthly",
            start: firstDayOfMonth(todayYYYYMM()),
            end: "",
            status: "open",
            members: [{ email, role: "owner" }],
          }]
        } else {
          nextProjects = nextProjects.map(p => ({ ...p, members: Array.isArray(p.members) ? p.members : [] }))
        }

        let nextExpenses = Array.isArray(doc.expenses) ? doc.expenses : []
        nextExpenses = nextExpenses.map(e => {
          let cat = e.category
          if (typeof cat === "string" && idToName.size && idToName.has(cat)) cat = idToName.get(cat)
          else if (cat && typeof cat === "object" && cat.name) cat = cat.name
          return {
            id: e.id || randId("exp"),
            who: e.who || "",
            category: cat || "",
            amount: Number(e.amount)||0,
            desc: e.desc || "",
            date: e.date || isoToday(),
            projectId: e.projectId || nextProjects[0].id,
          }
        })

        setPeople(nextPeople)
        setCategories(nextCategories)
        setProjects(nextProjects)
        setExpenses(nextExpenses)

        setSlug(savedSlug)
        localStorage.setItem("family:slug", savedSlug)

        const localPid = localStorage.getItem(`project:${savedSlug}`) || nextProjects[0]?.id || ""
        setSelectedProjectId(localPid)
        setPeriod(todayYYYYMM())
        setOnlyCategory("")
        setOnlyPerson("")
        setOrderMode("cat")
      } catch (e) {
        console.error(e); setError("Falha ao carregar seus dados.")
      }
    })()
  }, [status, session, router, search])

  // === Papel do usuário no projeto atual ===
  const myEmail = (session?.user?.email || "").toLowerCase()
  const myRole = useMemo(() => {
    const m = selectedProject?.members?.find(m => (m?.email || "").toLowerCase() === myEmail)
    return m?.role || "none"
  }, [selectedProject, myEmail])

  // viewer (ou não membro) -> somente leitura
  const readOnly = !(myRole === "owner" || myRole === "editor")

  // === salvar ===
  const savingRef = useRef(false)
  const setDocAndSave = useCallback((fn) => {
    if (readOnly) { alert("Somente leitura para seu papel atual."); return }
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true); setError("")
    try {
      let next = { people, categories, projects, expenses }
      next = typeof fn === "function" ? fn({ ...next }) : next

      setPeople(next.people); setCategories(next.categories)
      setProjects(next.projects); setExpenses(next.expenses)

      salvarFamilia(slug, next)
        .then(() => setLastSavedAt(new Date().toISOString()))
        .catch((e)=> { console.error(e); setError("Falha ao salvar.") })
        .finally(()=> { setSaving(false); savingRef.current = false })
    } catch (e) {
      console.error(e); setError("Erro ao preparar dados para salvar.")
      savingRef.current = false; setSaving(false)
    }
  }, [people, categories, projects, expenses, slug, readOnly])

  // pessoas
  function addPerson(name){ const n=(name||"").trim(); if(!n||people.includes(n))return; setDocAndSave(d=>{ d.people=[...d.people,n]; return d }) }
  function removePerson(name){ if(!confirm(`Remover "${name}"?`))return; setDocAndSave(d=>{ d.people=d.people.filter(p=>p!==name); d.expenses=d.expenses.filter(e=>e.who!==name); return d }) }
  // categorias
  function addCategoryLocal(name){ const n=(name||"").trim(); if(!n||categories.includes(n))return; setDocAndSave(d=>{ d.categories=[...d.categories,n]; return d }) }
  function removeCategory(n){
    const choice = prompt(`Remover a categoria "${n}"\n1 = Remover só deste projeto\n2 = Remover de TODOS os projetos`)
    if (choice==="1") setDocAndSave(d=>{ d.categories=d.categories.filter(c=>c!==n); d.expenses=d.expenses.filter(e=>!(e.category===n && e.projectId===selectedProjectId)); return d })
    else if (choice==="2") setDocAndSave(d=>{ d.categories=d.categories.filter(c=>c!==n); d.expenses=d.expenses.filter(e=>e.category!==n); return d })
  }
  // projetos
  function openNewProject(){ setShowNewProject(true); setNewProjectType("monthly"); setNewProjectName(""); setNewProjectStart(firstDayOfMonth(todayYYYYMM())); setNewProjectEnd("") }
  function createProject(){
    const email = session?.user?.email || ""
    const name=(newProjectName||"").trim()||"Projeto"
    const id="proj-"+Math.random().toString(36).slice(2,8)
    const p={ id,name,type:newProjectType,start:newProjectStart||null,end:newProjectEnd||"",status:"open",members:[{email,role:"owner"}] }
    setDocAndSave(d=>{ d.projects=[...d.projects,p]; return d })
    setSelectedProjectId(id); localStorage.setItem(`project:${slug}`, id); setShowNewProject(false)
  }
  function closeProject(id){ setDocAndSave(d=>{ d.projects=d.projects.map(p=>p.id===id?{...p,status:"closed"}:p); return d }) }
  function reopenProject(id){ setDocAndSave(d=>{ d.projects=d.projects.map(p=>p.id===id?{...p,status:"open"}:p); return d }) }
  function removeProject(id){
    if(!confirm("Remover este projeto?")) return
    setDocAndSave(d=>{ d.projects=d.projects.filter(p=>p.id!==id); return d })
    if(selectedProjectId===id){ const first=projects.find(p=>p.id!==id)?.id||""; setSelectedProjectId(first); localStorage.setItem(`project:${slug}`, first) }
  }
  // members
  function addMember(){
    if (readOnly) { alert("Somente leitura."); return }
    const email=(inviteEmail||"").trim().toLowerCase(); if(!email||!selectedProject) return
    setDocAndSave(d=>{
      d.projects=d.projects.map(p=>{
        if(p.id!==selectedProject.id) return p
        const members=Array.isArray(p.members)?p.members:[]
        if(members.some(m=>(m.email||"").toLowerCase()===email)) return p
        return {...p, members:[...members, {email, role:inviteRole}]}
      }); return d
    }); setInviteEmail("")
  }
  function removeMember(email){
    if (readOnly) { alert("Somente leitura."); return }
    if(!selectedProject) return
    setDocAndSave(d=>{
      d.projects=d.projects.map(p=>{
        if(p.id!==selectedProject.id) return p
        const members=(p.members||[]).filter(m=>(m.email||"").toLowerCase()!==email.toLowerCase())
        return {...p, members}
      }); return d
    })
  }

  // despesas
  function addExpense(){
    if (!selectedProject) { alert("Selecione/Crie um projeto."); return }
    const value = Number(String(amount).replace(",", "."))
    if (!who || !category || !Number.isFinite(value) || value<=0 || !date) return
    const e = { id: randId("exp"), who, category, amount: value, desc: (desc||"").trim(), date, projectId: selectedProjectId }
    setDocAndSave(d=>{ d.expenses=[...d.expenses, e]; return d })
    setWho(""); setCategory(""); setAmount(""); setDesc("")
  }
  function removeExpense(id){ setDocAndSave(d=>{ d.expenses=d.expenses.filter(e=>e.id!==id); return d }) }

  // derivados
  const projectExpenses = useMemo(()=>expenses.filter(e=>e.projectId===selectedProjectId),[expenses,selectedProjectId])
  const months = useMemo(()=>{ const set=new Set(projectExpenses.map(e=>monthKey(e.date))); const arr=[...set].filter(Boolean).sort(); return ["ALL",...arr] },[projectExpenses])
  const filtered = useMemo(()=>projectExpenses.filter(e => (period==="ALL"||monthKey(e.date)===period)).filter(e => (onlyCategory?e.category===onlyCategory:true)).filter(e => (onlyPerson?e.who===onlyPerson:true)),[projectExpenses,period,onlyCategory,onlyPerson])
  const filteredDateAsc = useMemo(()=>[...filtered].sort((a,b)=>a.date.localeCompare(b.date)),[filtered])
  const filteredDateDesc = useMemo(()=>[...filtered].sort((a,b)=>b.date.localeCompare(a.date)),[filtered])
  const groupedByCategory = useMemo(()=>{ const m=new Map(); filteredDateAsc.forEach(e=>{ const arr=m.get(e.category)||[]; arr.push(e); m.set(e.category,arr) }); return [...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))) },[filteredDateAsc])
  const total = useMemo(()=>filtered.reduce((s,e)=>s+(e.amount||0),0),[filtered])
  const byCategory = useMemo(()=>{ const m=new Map(); filtered.forEach(e=>m.set(e.category,(m.get(e.category)||0)+(e.amount||0))); return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value) },[filtered])
  const byPerson = useMemo(()=>{ const m=new Map(); filtered.forEach(e=>m.set(e.who,(m.get(e.who)||0)+(e.amount||0))); return [...m.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value) },[filtered])
  const settlements = useMemo(()=>{ const set=new Set(filtered.map(e=>e.who)); const arr=[...set]; const share=arr.length?total/arr.length:0; const paid=Object.fromEntries(arr.map(p=>[p,0])); filtered.forEach(e=>paid[e.who]+=(e.amount||0)); const delta=arr.map(p=>({person:p,diff:paid[p]-share})); const receivers=delta.filter(d=>d.diff>0).sort((a,b)=>b.diff-a.diff); const payers=delta.filter(d=>d.diff<0).sort((a,b)=>a.diff-b.diff); const ops=[]; let i=0,j=0; while(i<receivers.length&&j<payers.length){ const take=Math.min(receivers[i].diff,-payers[j].diff); if(take>0.009) ops.push({from:payers[j].person,to:receivers[i].person,amount:take}); receivers[i].diff-=take; payers[j].diff+=take; if(receivers[i].diff<0.009)i++; if(payers[j].diff>-0.009)j++ } return {delta,ops} },[filtered,total])
  const monthlySeries = useMemo(()=>{ const m=new Map(); projectExpenses.forEach(e=>{ const k=monthKey(e.date); m.set(k,(m.get(k)||0)+(e.amount||0)) }); const arr=[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,total])=>({month,total})); for(let i=0;i<arr.length;i++){ const w=arr.slice(Math.max(0,i-2),i+1).map(x=>x.total); arr[i].mm3=w.length?(w.reduce((a,b)=>a+b,0)/w.length):arr[i].total } return arr },[projectExpenses])

  if (status !== "authenticated") return <div className="p-6">Redirecionando…</div>

  const card = "rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
  const shareLink = typeof window!=="undefined" ? `${window.location.origin}/dashboard?fam=${slug}` : `/dashboard?fam=${slug}`

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gastos em Família</h1>
          <p className="text-xs opacity-70">Projeto: <b>{selectedProject?.name || "—"}</b> · Seu papel: <b>{myRole}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            Tema: {theme==="dark"?"Escuro":"Claro"}
          </button>
          <button onClick={()=> NextAuth.signOut({ callbackUrl: "/" })} className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Sair</button>
        </div>
      </div>

      {/* 1) PROJETO + Compartilhar */}
      <div className={`mt-4 p-3 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">Projeto:</label>
          <select className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-900" value={selectedProjectId} onChange={e=>{
            setSelectedProjectId(e.target.value); localStorage.setItem(`project:${slug}`, e.target.value)
          }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name} {p.status==="closed"?"(fechado)":""}</option>)}
          </select>
          <div className="flex gap-2 ml-auto">
            <button disabled={readOnly} className={`px-3 py-2 rounded-xl ${readOnly?"opacity-50 cursor-not-allowed":"bg-blue-600 text-white hover:bg-blue-700"}`} onClick={()=>!readOnly&&openNewProject()}>Novo</button>
            {selectedProject && selectedProject.status==="open" && <button disabled={readOnly} className="px-3 py-2 rounded-xl border disabled:opacity-50" onClick={()=>!readOnly&&closeProject(selectedProject.id)}>Fechar</button>}
            {selectedProject && selectedProject.status==="closed" && <button disabled={readOnly} className="px-3 py-2 rounded-xl border disabled:opacity-50" onClick={()=>!readOnly&&reopenProject(selectedProject.id)}>Reabrir</button>}
            {selectedProject && <button disabled={readOnly} className="px-3 py-2 rounded-xl border border-red-600 text-red-600 disabled:opacity-50" onClick={()=>!readOnly&&removeProject(selectedProject.id)}>Excluir</button>}
          </div>
        </div>

        {/* Compartilhar */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Compartilhar com pessoas</div>
            <div className="flex gap-2">
              <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="email@dominio.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
              <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={addMember}>Adicionar</button>
            </div>
            <div className="mt-3 text-xs opacity-70">
              Dica: quem receber o convite também pode abrir direto o link do projeto (abaixo).
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Link do projeto</div>
            <div className="flex gap-2">
              <input readOnly className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" value={shareLink} />
              <button className="px-4 py-2 rounded-xl border" onClick={()=>navigator.clipboard?.writeText(shareLink)}>Copiar</button>
            </div>
            <div className="mt-2 text-xs opacity-70">Abrindo o link, o usuário passa a usar este “fam”.</div>
          </div>
        </div>

        {/* Lista de membros */}
        <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="font-semibold mb-2">Membros do projeto</div>
          {selectedProject && (selectedProject.members?.length ? (
            <ul className="space-y-1">
              {selectedProject.members.map((m, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <span>{m.email} — <span className="uppercase text-xs opacity-70">{m.role}</span></span>
                  <button disabled={readOnly} className="text-xs text-red-600 disabled:opacity-50" onClick={()=>removeMember(m.email)}>remover</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs opacity-70">Nenhum membro ainda.</div>
          ))}
        </div>

        {showNewProject && (
          <div className="mt-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs block mb-1">Tipo</label>
                <select className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" value={newProjectType} onChange={e=>setNewProjectType(e.target.value)}>
                  <option value="monthly">Mensal</option>
                  <option value="trip">Viagem</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1">Nome</label>
                <input className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="Ex.: Maio/2025, Floripa, Reforma…" />
              </div>
              <div>
                <label className="text-xs block mb-1">Início</label>
                <input type="date" className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" value={newProjectStart} onChange={e=>setNewProjectStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs block mb-1">Fim (opcional)</label>
                <input type="date" className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" value={newProjectEnd} onChange={e=>setNewProjectEnd(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setShowNewProject(false)}>Cancelar</button>
              <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={createProject}>Criar</button>
            </div>
          </div>
        )}
      </div>

      {/* 2) Pessoas/Categorias */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">1) Pessoas do grupo</h3>
          <div className="flex gap-2">
            <input id="newPerson" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nome (ex.: Ana)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={()=>{
              const el=document.getElementById("newPerson"); const v=(el?.value||"").trim(); if(v) addPerson(v); if(el) el.value=""
            }}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map(p => (
              <span key={p} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border dark:border-slate-700">
                {p}
                {!readOnly && <button className="text-xs text-red-600" onClick={()=>removePerson(p)}>remover</button>}
              </span>
            ))}
          </div>
        </div>

        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">2) Categorias</h3>
          <div className="flex gap-2">
            <input id="newCat" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nova categoria (ex.: Remédios)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={()=>{
              const el=document.getElementById("newCat"); const v=(el?.value||"").trim(); if(v) addCategoryLocal(v); if(el) el.value=""
            }}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border dark:border-slate-700">
                {c}
                {!readOnly && <button className="text-xs text-red-600" onClick={()=>removeCategory(c)}>remover</button>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3) Adicionar gasto */}
      <div className={`mt-4 p-3 ${card}`}>
        <h3 className="font-semibold mb-3">3) <span className="text-slate-700 dark:text-slate-300">Adicionar gasto</span></h3>
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

      {/* 4) Título */}
      <div className="mt-6"><h2 className="font-semibold text-lg">Despesas</h2></div>

      {/* 5) Filtros */}
      <div className={`mt-2 p-3 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs">Período:</label>
          <div className="flex flex-wrap items-center gap-1">
            {months.map(m => (
              <button key={m} className={`px-3 py-1.5 rounded-full border transition ${period===m?"bg-slate-100 dark:bg-slate-800":""}`} onClick={()=>setPeriod(m)}>
                {m==="ALL" ? "Total" : monthLabel(m)}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
          <label className="text-xs">Pessoa:</label>
          <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={onlyPerson} onChange={e=>setOnlyPerson(e.target.value)}>
            <option value="">Todas</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <label className="text-xs">Categoria:</label>
          <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={onlyCategory} onChange={e=>setOnlyCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
          <label className="text-xs">Ordenação:</label>
          <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={orderMode} onChange={e=>setOrderMode(e.target.value)}>
            <option value="cat">Por categoria (agrupado)</option>
            <option value="date_desc">Data ↓</option>
            <option value="date_asc">Data ↑</option>
          </select>
          <div className="ml-auto text-sm font-medium">Total do período: {currency(total)}</div>
        </div>
      </div>

      {/* 6) Lista */}
      <div className="mt-3">
        {orderMode==="cat" ? (
          <div className="space-y-4">
            {groupedByCategory.map(([catName, arr]) => (
              <div key={catName} className={card}>
                <div className="px-4 py-2 font-semibold bg-slate-50 dark:bg-slate-900/50 rounded-t-2xl border-b border-slate-200 dark:border-slate-800">
                  {catName} — {currency(arr.reduce((s,e)=>s+(e.amount||0),0))}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b dark:border-slate-800">
                        <th className="py-2 pr-2 pl-4">Data</th>
                        <th className="py-2 pr-2">Pessoa</th>
                        <th className="py-2 pr-2">Descrição</th>
                        <th className="py-2 pr-4 text-right">Valor</th>
                        <th className="py-2 pr-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {arr.map(e=>(
                        <tr key={e.id} className="border-b dark:border-slate-900">
                          <td className="py-2 pr-2 pl-4">{e.date}</td>
                          <td className="py-2 pr-2">{e.who}</td>
                          <td className="py-2 pr-2">{e.desc}</td>
                          <td className="py-2 pr-4 text-right">{currency(e.amount)}</td>
                          <td className="py-2 pr-2 text-right">
                            {!readOnly && <button className="text-xs text-red-600" onClick={()=>removeExpense(e.id)}>remover</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {groupedByCategory.length===0 && <div className="text-xs opacity-70">Sem despesas no filtro atual.</div>}
          </div>
        ) : (
          <div className={`${card} overflow-x-auto`}>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b dark:border-slate-800">
                  <th className="py-2 pr-2 pl-4">Data</th>
                  <th className="py-2 pr-2">Pessoa</th>
                  <th className="py-2 pr-2">Categoria</th>
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {(orderMode==="date_desc"?filteredDateDesc:filteredDateAsc).map(e=>(
                  <tr key={e.id} className="border-b dark:border-slate-900">
                    <td className="py-2 pr-2 pl-4">{e.date}</td>
                    <td className="py-2 pr-2">{e.who}</td>
                    <td className="py-2 pr-2">{e.category}</td>
                    <td className="py-2 pr-2">{e.desc}</td>
                    <td className="py-2 pr-4 text-right">{currency(e.amount)}</td>
                    <td className="py-2 pr-2 text-right">
                      {!readOnly && <button className="text-xs text-red-600" onClick={()=>removeExpense(e.id)}>remover</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0 && <div className="text-xs opacity-70 p-3">Sem despesas no filtro atual.</div>}
          </div>
        )}
      </div>

      {/* 7) Resumos */}
      <div className="mt-6 grid md:grid-cols-3 gap-3">
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">Quem pagou quanto</h3>
          <ul className="space-y-1">
            {byPerson.map(r => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span>{currency(r.value)}</span></li>)}
          </ul>
        </div>
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">Totais por categoria</h3>
          <ul className="space-y-1">
            {byCategory.map(r => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span>{currency(r.value)}</span></li>)}
          </ul>
        </div>
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">Acertos (rateio)</h3>
          {settlements.ops.length===0 ? <div className="text-xs opacity-70">Tudo certo, ninguém deve nada.</div> : (
            <ul className="space-y-1">
              {settlements.ops.map((op,i)=>(<li key={i} className="flex justify-between"><span>{op.from} → {op.to}</span><span>{currency(op.amount)}</span></li>))}
            </ul>
          )}
        </div>
      </div>

      {/* 8) Gráficos */}
      <div className={`mt-8 p-3 ${card}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Gráficos</h3>
          <div className="flex gap-2">
            <button className={`px-3 py-1.5 rounded-full border ${chartType==="pizza"?"bg-slate-100 dark:bg-slate-800":""}`} onClick={()=>setChartType("pizza")}>Pizza</button>
            <button className={`px-3 py-1.5 rounded-full border ${chartType==="linha"?"bg-slate-100 dark:bg-slate-800":""}`} onClick={()=>setChartType("linha")}>Linha (mensal)</button>
          </div>
        </div>
        <ChartsErrorBoundary>
          {chartType==="pizza" ? (
            <div className="h-72 w-full mt-2">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="value" data={byCategory} cx="50%" cy="50%" outerRadius={110} label={(d)=>`${d.name}: ${currency(d.value)}`}>
                    {byCategory.map((d,i)=><Cell key={i} fill={`hsl(${(i*67)%360} 70% 48%)`} />)}
                  </Pie>
                  <Tooltip formatter={(v,n)=>[currency(v),n]} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full mt-2">
              <ResponsiveContainer>
                <LineChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} />
                  <YAxis />
                  <Tooltip formatter={(v,n)=>[currency(v), n==="mm3"?"MM3":"Total"]} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" dot />
                  <Line type="monotone" dataKey="mm3" stroke="#82ca9d" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartsErrorBoundary>
      </div>

      {/* Rodapé */}
      <div className="mt-6 text-xs opacity-70">
        {saving ? "Salvando..." : (lastSavedAt ? `Salvo às ${fmtHora(lastSavedAt)}` : "")}
        {error && <span className="ml-2 text-red-600">{error}</span>}
      </div>
    </div>
  )
}
