"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as NextAuth from "next-auth/react"
import { useRouter } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

// === Gráficos (recharts)
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts"

/* ===================== Helpers ===================== */
const currency = (v) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00")
const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) } catch { return "" } }
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const isoToday = () => new Date().toISOString().slice(0,10)
const firstDayOfMonth = (ym) => `${ym}-01`
const lastDayOfMonth = (ym) => {
  const [y,m] = ym.split("-").map(Number)
  const d = new Date(y, m, 0) // último dia
  return d.toISOString().slice(0,10)
}
const randId = (p) => (p||"id")+"-"+Math.random().toString(36).slice(2,9)
function hash36(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i) // djb2
  return (h >>> 0).toString(36)
}
const slugFromEmail = (email) => {
  const norm = String(email || "").trim().toLowerCase()
  return `fam-${hash36(norm)}`
}

/* ===================== Error Boundary (evita derrubar a página) ===================== */
class ChartsErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false } }
  static getDerivedStateFromError(){ return { hasError: true } }
  componentDidCatch(err, info){ console.error("Charts crashed:", err, info) }
  render(){
    if (this.state.hasError) {
      return (
        <div className="h-72 grid place-items-center text-sm text-red-600">
          Erro ao renderizar os gráficos. Recarregue a página ou ajuste os filtros.
        </div>
      )
    }
    return this.props.children
  }
}

/* ===================== Page (proteção por login) ===================== */
export default function Page() {
  const sess = NextAuth?.useSession ? NextAuth.useSession() : { data: null, status: "unauthenticated" }
  const { data: session, status } = sess
  const router = useRouter()

  // ---- preferências locais ----
  const [theme, setTheme] = useState("dark")
  const [slug, setSlug] = useState("")
  const [period, setPeriod] = useState(todayYYYYMM()) // yyyy-MM ou "ALL"
  const [sortAsc, setSortAsc] = useState(false)
  const [onlyCategory, setOnlyCategory] = useState("") // filtro por categoria
  const [onlyPerson, setOnlyPerson] = useState("")     // filtro por pessoa
  const [chartType, setChartType] = useState("pizza")  // "pizza" | "linha"
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // ----- Documento (nuvem) -----
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState(["Mercado", "Carro", "Aluguel", "Lazer"])
  const [projects, setProjects] = useState([]) // {id,name,type,start,end,status, ...}
  const [expenses, setExpenses] = useState([]) // {id, who, category, amount, desc, date, projectId}

  // ----- Projeto atual -----
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])
  const isClosed = selectedProject?.status === "closed"
  const readOnly = false // projeto fechado continua editável

  // ----- Criar projeto -----
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectType, setNewProjectType] = useState("monthly")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectStart, setNewProjectStart] = useState(firstDayOfMonth(todayYYYYMM()))
  const [newProjectEnd, setNewProjectEnd] = useState("")

  // ----- Lançar despesa -----
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))

  // ======= carregar =======
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin")
      return
    }
    if (status !== "authenticated") return

    const email = session?.user?.email || ""
    const autoSlug = slugFromEmail(email)

    // usa slug do localStorage se existir; senão usa o do email
    const savedSlug = localStorage.getItem("family:slug") || autoSlug

    ;(async () => {
      setError("")
      try {
        const fromCloud = await carregarFamilia(savedSlug)
        const doc = fromCloud || {}
        let nextProjects = Array.isArray(doc.projects) ? doc.projects : []

        // migra se não houver projetos
        if (nextProjects.length === 0) {
          const defaultProject = {
            id: "proj-"+Math.random().toString(36).slice(2,8),
            name: "Projeto",
            type: "monthly",
            start: firstDayOfMonth(todayYYYYMM()),
            end: "",
            status: "open"
          }
          nextProjects = [defaultProject]
        }

        setPeople(Array.isArray(doc.people) ? doc.people : [])
        setCategories(Array.isArray(doc.categories) ? doc.categories : [])
        setProjects(nextProjects)
        setExpenses(Array.isArray(doc.expenses) ? doc.expenses : [])

        setSlug(savedSlug)
        localStorage.setItem("family:slug", savedSlug)

        const localPid = localStorage.getItem(`project:${savedSlug}`) || nextProjects[0]?.id || ""
        setSelectedProjectId(localPid)
        setPeriod(todayYYYYMM())
        setOnlyCategory("")
        setOnlyPerson("")
      } catch (e) {
        console.error(e)
        setError("Falha ao carregar seus dados. Tente novamente.")
      }
    })()
  }, [status, session, router])

  // ======= salvar =======
  const savingRef = useRef(false)
  const setDocAndSave = useCallback((fn) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError("")
    try {
      let next = {
        people, categories, projects, expenses
      }
      // aplicar mutação
      next = typeof fn === "function" ? fn({ ...next }) : next

      // salvar estado local
      setPeople(next.people)
      setCategories(next.categories)
      setProjects(next.projects)
      setExpenses(next.expenses)

      // persistir (server action)
      salvarFamilia(slug, next)
        .then(() => setLastSavedAt(new Date().toISOString()))
        .catch((e)=> { console.error(e); setError("Falha ao salvar.") })
        .finally(()=> { setSaving(false); savingRef.current = false })
    } catch (e) {
      console.error(e)
      setError("Erro ao preparar dados para salvar.")
      savingRef.current = false
      setSaving(false)
    }
  }, [people, categories, projects, expenses, slug])

  /* ===================== Pessoas ===================== */
  function addPerson(name) {
    const n = (name || "").trim()
    if (!n) return
    if (people.includes(n)) return
    setDocAndSave(d => { d.people = [...d.people, n]; return d })
  }
  function removePerson(name) {
    if (!confirm(`Remover a pessoa "${name}"?`)) return
    setDocAndSave(d => {
      d.people = d.people.filter(p => p !== name)
      d.expenses = d.expenses.filter(e => e.who !== name)
      return d
    })
  }

  /* ===================== Categorias ===================== */
  function addCategoryLocal(name) {
    const n = (name || "").trim()
    if (!n) return
    if (categories.includes(n)) return
    setDocAndSave(d => { d.categories = [...d.categories, n]; return d })
  }
  function removeCategory(n) {
    if (!selectedProject) {
      if (!confirm(`Remover a categoria "${n}" de TODOS os projetos? Todas as despesas dessa categoria serão apagadas.`)) return
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => e.category !== n); return d })
      return
    }
    const choice = prompt(`Remover a categoria "${n}"\n1 = Remover só deste projeto (${selectedProject.name})\n2 = Remover de TODOS os projetos`)
    if (choice === "1") {
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => !(e.category === n && e.projectId === selectedProject.id)); return d })
    } else if (choice === "2") {
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => e.category !== n); return d })
    }
  }

  /* ===================== Projetos ===================== */
  function openNewProject() {
    setShowNewProject(true)
    setNewProjectType("monthly")
    setNewProjectName("")
    setNewProjectStart(firstDayOfMonth(todayYYYYMM()))
    setNewProjectEnd("")
  }
  function createProject() {
    const name = (newProjectName || "").trim() || "Projeto"
    const id = "proj-"+Math.random().toString(36).slice(2,8)
    const p = {
      id, name, type: newProjectType, start: newProjectStart || null,
      end: newProjectEnd || "", status: "open"
    }
    setDocAndSave(d => { d.projects = [...d.projects, p]; return d })
    setSelectedProjectId(id)
    localStorage.setItem(`project:${slug}`, id)
    setShowNewProject(false)
  }
  function closeProject(id) {
    setDocAndSave(d => { d.projects = d.projects.map(p => p.id === id ? { ...p, status: "closed" } : p); return d })
  }
  function reopenProject(id) {
    setDocAndSave(d => { d.projects = d.projects.map(p => p.id === id ? { ...p, status: "open" } : p); return d })
  }
  function removeProject(id) {
    if (!confirm("Remover este projeto? As despesas permanecerão, mas sem vínculo com este projeto.")) return
    setDocAndSave(d => { d.projects = d.projects.filter(p => p.id !== id); return d })
    if (selectedProjectId === id) {
      const first = projects.find(p => p.id !== id)?.id || ""
      setSelectedProjectId(first)
      localStorage.setItem(`project:${slug}`, first)
    }
  }

  /* ===================== Lançar despesas ===================== */
  function addExpense() {
    if (!selectedProject) { alert("Selecione/Crie um projeto."); return }
    const value = Number(String(amount).replace(",", "."))
    if (!who || !category || !Number.isFinite(value) || value <= 0 || !date) return
    const e = { id: "exp-" + Math.random().toString(36).slice(2,9), who, category, amount: value, desc: (desc || "").trim(), date, projectId: selectedProjectId }
    setDocAndSave(d => { d.expenses = [...d.expenses, e]; return d })
    setWho(""); setCategory(""); setAmount(""); setDesc("")
  }
  function removeExpense(id) { setDocAndSave(d => { d.expenses = d.expenses.filter(e => e.id !== id); return d }) }

  /* ===================== Derivados por Projeto & Período ===================== */
  const projectExpenses = useMemo(() => expenses.filter(e => e.projectId === selectedProjectId), [expenses, selectedProjectId])

  // meses + "ALL" (Total do projeto)
  const months = useMemo(() => {
    const set = new Set(projectExpenses.map(e => monthKey(e.date)))
    const arr = [...set].filter(Boolean).sort()
    return ["ALL", ...arr]
  }, [projectExpenses])

  const filtered = useMemo(() => {
    return projectExpenses
      .filter(e => (period === "ALL" ? true : monthKey(e.date) === period))
      .filter(e => (onlyCategory ? e.category === onlyCategory : true))
      .filter(e => (onlyPerson ? e.who === onlyPerson : true))
      .sort((a,b) => (sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
  }, [projectExpenses, period, onlyCategory, onlyPerson, sortAsc])

  const total = useMemo(() => filtered.reduce((s, e) => s + (e.amount||0), 0), [filtered])

  const byCategory = useMemo(() => {
    const m = new Map()
    filtered.forEach(e => m.set(e.category, (m.get(e.category)||0) + (e.amount||0)))
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [filtered])

  const byPerson = useMemo(() => {
    const m = new Map()
    filtered.forEach(e => m.set(e.who, (m.get(e.who)||0) + (e.amount||0)))
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [filtered])

  // “acertos” (rateio) simples: cada um deveria pagar a mesma fração do total filtrado
  const settlements = useMemo(() => {
    const peopleSet = new Set(filtered.map(e => e.who))
    const arr = [...peopleSet]
    const share = arr.length ? total / arr.length : 0
    const paid = Object.fromEntries(arr.map(p => [p, 0]))
    filtered.forEach(e => paid[e.who] += (e.amount||0))
    const delta = arr.map(p => ({ person: p, diff: paid[p] - share })) // + pagou a mais / - pagou a menos

    // Quem deve para quem: positivos recebem, negativos pagam
    const receivers = delta.filter(d => d.diff > 0).sort((a,b)=>b.diff-a.diff)
    const payers = delta.filter(d => d.diff < 0).sort((a,b)=>a.diff-b.diff)

    const ops = []
    let i=0, j=0
    while (i<receivers.length && j<payers.length) {
      const take = Math.min(receivers[i].diff, -payers[j].diff)
      if (take > 0.009) ops.push({ from: payers[j].person, to: receivers[i].person, amount: take })
      receivers[i].diff -= take
      payers[j].diff += take
      if (receivers[i].diff < 0.009) i++
      if (payers[j].diff > -0.009) j++
    }
    return { delta, ops }
  }, [filtered, total])

  // séries mensais para linhas
  const monthlySeries = useMemo(() => {
    const map = new Map()
    projectExpenses.forEach(e => {
      const mk = monthKey(e.date)
      map.set(mk, (map.get(mk)||0) + (e.amount||0))
    })
    const arr = [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }))
    // MM3
    for (let i=0;i<arr.length;i++){
      const w = arr.slice(Math.max(0,i-2), i+1).map(x=>x.total)
      arr[i].mm3 = w.length ? (w.reduce((a,b)=>a+b,0)/w.length) : arr[i].total
    }
    return arr
  }, [projectExpenses])

  /* ===================== UI ===================== */
  if (status !== "authenticated") return <div className="p-6">Redirecionando para login…</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Gastos em Família</h1>
          <p className="text-xs opacity-70">Projeto: <b>{selectedProject?.name || "—"}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{
            const next = theme==="dark" ? "light" : "dark"
            setTheme(next)
            document.documentElement.classList.toggle("dark", next==="dark")
            localStorage.setItem("theme", next)
          }} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Tema: {theme==="dark"?"Escuro":"Claro"}</button>
          <button onClick={()=> NextAuth.signOut({ callbackUrl: "/" })} className="px-3 py-1 rounded border">Sair</button>
        </div>
      </div>

      {/* Projetos */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs">Projeto:</label>
        <select className="px-2 py-1 rounded border dark:bg-slate-900" value={selectedProjectId} onChange={e=>{
          setSelectedProjectId(e.target.value)
          localStorage.setItem(`project:${slug}`, e.target.value)
        }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} {p.status==="closed"?"(fechado)":""}</option>)}
        </select>
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={openNewProject}>Novo</button>
        {selectedProject && selectedProject.status==="open" && <button className="px-3 py-1 rounded border" onClick={()=>closeProject(selectedProject.id)}>Fechar</button>}
        {selectedProject && selectedProject.status==="closed" && <button className="px-3 py-1 rounded border" onClick={()=>reopenProject(selectedProject.id)}>Reabrir</button>}
        {selectedProject && <button className="px-3 py-1 rounded border border-red-600 text-red-600" onClick={()=>removeProject(selectedProject.id)}>Excluir</button>}
      </div>

      {/* Criar Projeto */}
      {showNewProject && (
        <div className="mt-3 p-3 rounded-lg border dark:border-slate-700">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs block mb-1">Tipo</label>
              <select className="px-2 py-1 rounded border dark:bg-slate-900 w-full" value={newProjectType} onChange={e=>setNewProjectType(e.target.value)}>
                <option value="monthly">Mensal</option>
                <option value="trip">Viagem</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1">Nome</label>
              <input className="px-2 py-1 rounded border dark:bg-slate-900 w-full" value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="Ex.: Maio/2025, Floripa, Reforma…" />
            </div>
            <div>
              <label className="text-xs block mb-1">Início</label>
              <input type="date" className="px-2 py-1 rounded border dark:bg-slate-900 w-full" value={newProjectStart} onChange={e=>setNewProjectStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs block mb-1">Fim (opcional)</label>
              <input type="date" className="px-2 py-1 rounded border dark:bg-slate-900 w-full" value={newProjectEnd} onChange={e=>setNewProjectEnd(e.target.value)} />
            </div>
          </div>
          <div className="mt-2 flex gap-2 justify-end">
            <button className="px-3 py-1 rounded border" onClick={()=>setShowNewProject(false)}>Cancelar</button>
            <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={createProject}>Criar</button>
          </div>
        </div>
      )}

      {/* Período / Filtros / Ordenação */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs">Período:</label>
        <div className="flex items-center gap-1">
          {months.map(m => (
            <button key={m} className={`px-2 py-1 rounded border ${period===m?"bg-slate-200 dark:bg-slate-800":""}`} onClick={()=>setPeriod(m)}>
              {m==="ALL" ? "Total" : monthLabel(m)}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <label className="text-xs">Pessoa:</label>
        <select className="px-2 py-1 rounded border dark:bg-slate-900" value={onlyPerson} onChange={e=>setOnlyPerson(e.target.value)}>
          <option value="">Todas</option>
          {people.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="text-xs">Categoria:</label>
        <select className="px-2 py-1 rounded border dark:bg-slate-900" value={onlyCategory} onChange={e=>setOnlyCategory(e.target.value)}>
          <option value="">Todas</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <button className="px-2 py-1 rounded border" onClick={()=>setSortAsc(s => !s)}>Ordenar por data: {sortAsc?"↑":"↓"}</button>
      </div>

      {/* Lançar despesa */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input aria-label="Data" disabled={readOnly} className="px-2 py-2 rounded border dark:bg-slate-900" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <select aria-label="Pessoa" disabled={readOnly} className="px-2 py-2 rounded border dark:bg-slate-900" value={who} onChange={e=>setWho(e.target.value)}>
          <option value="">Quem pagou?</option>
          {people.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Categoria" disabled={readOnly} className="px-2 py-2 rounded border dark:bg-slate-900" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">Categoria</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input aria-label="Descrição" disabled={readOnly} className="px-2 py-2 rounded border dark:bg-slate-900 md:col-span-2" placeholder="Descrição" value={desc} onChange={e=>setDesc(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addExpense() }}} />
        <input aria-label="Valor" disabled={readOnly} className="px-2 py-2 rounded border dark:bg-slate-900" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter"){ e.preventDefault(); addExpense() }}} />
        <div className="md:col-span-6 flex justify-end">
          <button disabled={readOnly} onClick={addExpense} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">Adicionar</button>
        </div>
      </div>

      {/* Pessoas / Categorias rápidas */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded border dark:border-slate-700 p-2">
          <h3 className="font-semibold mb-2">Pessoas</h3>
          <div className="flex gap-2">
            <input id="newPerson" className="px-2 py-1 rounded border dark:bg-slate-900 flex-1" placeholder="Nome…" />
            <button className="px-3 py-1 rounded bg-slate-700 text-white" onClick={()=>{
              const el = document.getElementById("newPerson"); const v = (el?.value||"").trim(); if (v) addPerson(v); if (el) el.value=""
            }}>Adicionar</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {people.map(p => (
              <span key={p} className="inline-flex items-center gap-2 px-2 py-1 rounded border dark:border-slate-700">
                {p}
                <button className="text-xs text-red-600" onClick={()=>removePerson(p)}>remover</button>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded border dark:border-slate-700 p-2">
          <h3 className="font-semibold mb-2">Categorias</h3>
          <div className="flex gap-2">
            <input id="newCat" className="px-2 py-1 rounded border dark:bg-slate-900 flex-1" placeholder="Categoria…" />
            <button className="px-3 py-1 rounded bg-slate-700 text-white" onClick={()=>{
              const el = document.getElementById("newCat"); const v = (el?.value||"").trim(); if (v) addCategoryLocal(v); if (el) el.value=""
            }}>Adicionar</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map(c => (
              <span key={c} className="inline-flex items-center gap-2 px-2 py-1 rounded border dark:border-slate-700">
                {c}
                <button className="text-xs text-red-600" onClick={()=>removeCategory(c)}>remover</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de despesas */}
      <div className="mt-6">
        <h2 className="font-semibold">Despesas — {period==="ALL" ? "Total do projeto" : monthLabel(period)} — Total: {currency(total)}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b dark:border-slate-700">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Pessoa</th>
                <th className="py-2 pr-2">Categoria</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2 text-right">Valor</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b dark:border-slate-800">
                  <td className="py-1 pr-2">{e.date}</td>
                  <td className="py-1 pr-2">{e.who}</td>
                  <td className="py-1 pr-2">{e.category}</td>
                  <td className="py-1 pr-2">{e.desc}</td>
                  <td className="py-1 pr-2 text-right">{currency(e.amount)}</td>
                  <td className="py-1 pr-2 text-right">
                    <button className="text-xs text-red-600" onClick={()=>removeExpense(e.id)}>remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumos / “Acertos” */}
      <div className="mt-6 grid md:grid-cols-3 gap-3">
        <div className="rounded border dark:border-slate-700 p-3">
          <h3 className="font-semibold mb-2">Quem pagou quanto</h3>
          <ul className="space-y-1">
            {byPerson.map(r => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span>{currency(r.value)}</span></li>)}
          </ul>
        </div>
        <div className="rounded border dark:border-slate-700 p-3">
          <h3 className="font-semibold mb-2">Totais por categoria</h3>
          <ul className="space-y-1">
            {byCategory.map(r => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span>{currency(r.value)}</span></li>)}
          </ul>
        </div>
        <div className="rounded border dark:border-slate-700 p-3">
          <h3 className="font-semibold mb-2">Acertos (rateio)</h3>
          {settlements.ops.length === 0 ? (
            <div className="text-xs opacity-70">Tudo certo, ninguém deve nada.</div>
          ) : (
            <ul className="space-y-1">
              {settlements.ops.map((op, i) => (
                <li key={i} className="flex justify-between"><span>{op.from} → {op.to}</span><span>{currency(op.amount)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Gráficos</h3>
          <div className="flex gap-2">
            <button className={`px-3 py-1 rounded border ${chartType==="pizza"?"bg-slate-200 dark:bg-slate-800":""}`} onClick={()=>setChartType("pizza")}>Pizza</button>
            <button className={`px-3 py-1 rounded border ${chartType==="linha"?"bg-slate-200 dark:bg-slate-800":""}`} onClick={()=>setChartType("linha")}>Linha (mensal)</button>
          </div>
        </div>

        <ChartsErrorBoundary>
          {chartType === "pizza" ? (
            <div className="h-72 w-full mt-2">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="value" data={byCategory} cx="50%" cy="50%" outerRadius={100} label={(d)=>`${d.name}: ${currency(d.value)}`}>
                    {byCategory.map((d, i) => <Cell key={i} fill={`hsl(${(i*67)%360} 70% 48%)`} />)}
                  </Pie>
                  <Tooltip formatter={(v, n)=>[currency(v), n]} />
                  <Legend />
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
                  <Tooltip formatter={(v, n)=>[currency(v), n==="mm3"?"MM3":"Total"]} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" dot />
                  <Line type="monotone" dataKey="mm3" stroke="#82ca9d" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartsErrorBoundary>
      </div>

      {/* Rodapé: status de salvamento */}
      <div className="mt-6 text-xs opacity-70">
        {saving ? "Salvando..." : (lastSavedAt ? `Salvo às ${fmtHora(lastSavedAt)}` : "")}
        {error && <span className="ml-2 text-red-600">{error}</span>}
      </div>
    </div>
  )
}
