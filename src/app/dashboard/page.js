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

  // Papel do usuário
  const myEmail = (session?.user?.email || "").toLowerCase()
  const myRole = useMemo(() => {
    const m = selectedProject?.members?.find(m => (m?.email || "").toLowerCase() === myEmail)
    return m?.role || "none"
  }, [selectedProject, myEmail])

  const readOnly = !(myRole === "owner" || myRole === "editor")

  // salvar
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

      {/* 1) Projeto + Compartilhar */}
      {/* ... (restante idêntico ao arquivo anterior que te passei) ... */}
    </div>
  )
}
