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
const firstDayOfMonth = (yyyyMM) => `${yyyyMM}-01`

// ====== Cor única por categoria (HSL baseado no nome)
function colorFor(name = "") {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue}, 70%, 45%)`
}

// ====== Slug automático a partir do e-mail (hash estável legível)
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
  useEffect(() => { if (status === "unauthenticated") router.replace("/") }, [status, router])
  if (status === "loading") return <div className="p-6">Carregando…</div>
  if (!session) return <div className="p-6">Faça login para continuar.</div>
  return <GastosApp user={session.user} onSignOut={NextAuth.signOut} />
}

/* ===================== App ===================== */
function GastosApp({ user, onSignOut }) {
  // ----- Slug automático (derivado do e-mail) -----
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
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

  // ----- Filtros/ordenacao/período -----
  const [selectedMonth, setSelectedMonth] = useState(todayYYYYMM())
  const [filterCat, setFilterCat] = useState("Todos")
  const [filterWho, setFilterWho] = useState("Todos")
  const [sortOrder, setSortOrder] = useState("desc") // "desc" | "asc"

  // ----- Gráficos -----
  const [chartType, setChartType] = useState("pie") // "pie" | "line"
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  /* ===================== Persistência / Save ===================== */
  const setDocAndSave = useCallback((next) => {
    const doc = { people, categories, projects, expenses }
    const merged = typeof next === "function" ? next(doc) : next
    queueSave(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, categories, projects, expenses, slug])

  const queueSave = useCallback((next) => {
    if (!slug || !next) return
    setPeople(next.people); setCategories(next.categories); setProjects(next.projects); setExpenses(next.expenses)
    _queueSave(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const saveTimer = useRef(null)
  const _queueSave = useCallback((next) => {
    if (!slug) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true); setError("")
      try {
        const res = await salvarFamilia(slug, {
          people: next.people,
          categories: next.categories,
          projects: next.projects,
          expenses: next.expenses,
        })
        setLastSavedAt(res?.updatedAt || new Date().toISOString())
      } catch(e) {
        setError(String(e.message || e))
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [slug])

  /* ===================== Load: slug automático + migração do local antigo ===================== */
  const hasData = (doc) => {
    if (!doc) return false
    const anyArr = (a) => Array.isArray(a) && a.length > 0
    return anyArr(doc.people) || anyArr(doc.categories) || anyArr(doc.projects) || anyArr(doc.expenses)
  }

  const loadBySlug = useCallback(async (slugToLoad) => {
    if (!slugToLoad) return
    setLoading(true); setError("")
    try {
      const data = await carregarFamilia(slugToLoad)
      const doc = data || { people: [], categories: [], projects: [], expenses: [] }

      let nextProjects = Array.isArray(doc.projects) ? doc.projects : []
      if (!nextProjects.length) {
        nextProjects = [{
          id: "proj-" + Math.random().toString(36).slice(2),
          name: todayYYYYMM(),
          type: "monthly",
          start: firstDayOfMonth(todayYYYYMM()),
          end: "",
          status: "open"
        }]
      }

      setPeople(Array.isArray(doc.people) ? doc.people : [])
      setCategories(Array.isArray(doc.categories) ? doc.categories : [])
      setProjects(nextProjects)
      setExpenses(Array.isArray(doc.expenses) ? doc.expenses : [])

      setSlug(slugToLoad)
      localStorage.setItem("family:slug", slugToLoad)

      const localPid = localStorage.getItem(`project:${slugToLoad}`) || nextProjects[0]?.id || ""
      setSelectedProjectId(localPid)
      setSelectedMonth(todayYYYYMM())
      setFilterCat("Todos")
      setFilterWho("Todos")
    } catch(e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const email = user?.email
      if (!email) { setLoading(false); return }
      const auto = slugFromEmail(email)
      try {
        // Migração: se tinha um slug antigo diferente e com dados, copia para o novo
        const oldSlug = localStorage.getItem("family:slug")
        if (oldSlug && oldSlug !== auto) {
          const targetDoc = await carregarFamilia(auto)
          const sourceDoc = await carregarFamilia(oldSlug)
          const targetHas = hasData(targetDoc)
          const sourceHas = hasData(sourceDoc)
          if (!targetHas && sourceHas) {
            await salvarFamilia(auto, sourceDoc)
          }
        }
      } catch {}
      await loadBySlug(auto)
    })()
  }, [user?.email, loadBySlug])

  /* ===================== Ações: Projeto ===================== */
  function closeCurrentProject() {
    if (!selectedProject) return
    const ok = confirm(`Fechar o projeto "${selectedProject.name}"? Você ainda poderá editar.`)
    if (!ok) return
    setDocAndSave(d => {
      d.projects = d.projects.map(p => p.id === selectedProject.id ? { ...p, status: "closed", end: p.end || new Date().toISOString().slice(0,10) } : p)
      return d
    })
  }
  function reopenCurrentProject() {
    if (!selectedProject) return
    const ok = confirm(`Reabrir o projeto "${selectedProject.name}"?`)
    if (!ok) return
    setDocAndSave(d => {
      d.projects = d.projects.map(p => p.id === selectedProject.id ? { ...p, status: "open", end: p.end || null } : p)
      return d
    })
  }
  function deleteCurrentProject() {
    if (!selectedProject) return
    const ok = confirm(`Excluir o projeto "${selectedProject.name}"? Todas as despesas dele serão apagadas. Esta ação não pode ser desfeita.`)
    if (!ok) return
    const next = projects.find(p => p.id !== selectedProject.id) || null
    setDocAndSave(d => {
      d.expenses = d.expenses.filter(e => e.projectId !== selectedProject.id)
      d.projects = d.projects.filter(p => p.id !== selectedProject.id)
      return d
    })
    setSelectedProjectId(next?.id || "")
    try { if (slug) localStorage.setItem(`project:${slug}`, next?.id || "") } catch {}
  }
  function createProject() {
    const type = newProjectType
    const name = (newProjectName || "").trim()
    let finalName = name
    let start = newProjectStart
    let end = newProjectEnd
    if (type === "monthly") { finalName = finalName || todayYYYYMM(); start = firstDayOfMonth(finalName); end = "" }
    else { finalName = finalName || (type === "trip" ? "Viagem" : "Projeto") }
    const p = { id: "proj-" + Math.random().toString(36).slice(2), name: finalName, type, start, end, status: "open" }
    setDocAndSave(d => { d.projects = [...d.projects, p]; return d })
    setSelectedProjectId(p.id)
    try { localStorage.setItem(`project:${slug}`, p.id) } catch {}
    setShowNewProject(false)
    setNewProjectName(""); setNewProjectStart(firstDayOfMonth(todayYYYYMM())); setNewProjectEnd(""); setNewProjectType("monthly")
  }

  /* ===================== Ações: Pessoas/Categorias ===================== */
  function addPerson(n) {
    const name = String(n || "").trim()
    if (!name || people.includes(name)) return
    setDocAndSave(d => { d.people = [...d.people, name]; return d })
  }
  function removePerson(n) {
    if (!confirm(`Remover a pessoa "${n}"? As despesas dela serão apagadas.`)) return
    setDocAndSave(d => {
      d.people = d.people.filter(p => p !== n)
      d.expenses = d.expenses.filter(e => e.who !== n)
      return d
    })
  }
  function addCategory(n) {
    const name = String(n || "").trim()
    if (!name || categories.includes(name)) return
    setDocAndSave(d => { d.categories = [...d.categories, name]; return d })
  }
  function removeCategory(n) {
    if (!selectedProject) {
      if (!confirm(`Remover a categoria "${n}" de TODOS os projetos? Todas as despesas dessa categoria serão apagadas.`)) return
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => e.category !== n); return d })
      return
    }
    const choice = prompt(`Remover a categoria "${n}"\n1 = Remover SOMENTE do projeto atual (${selectedProject.name})\n2 = Remover de TODOS os projetos`)
    if (choice === "1") {
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => !(e.category === n && e.projectId === selectedProject.id)); return d })
    } else if (choice === "2") {
      setDocAndSave(d => { d.categories = d.categories.filter(c => c !== n); d.expenses = d.expenses.filter(e => e.category !== n); return d })
    }
  }

  /* ===================== Ações: Despesas ===================== */
  function addExpense() {
    if (!selectedProject) { alert("Selecione/Crie um projeto."); return }
    const value = Number(String(amount).replace(",", "."))
    if (!who || !category || !Number.isFinite(value) || value <= 0 || !date) return
    const e = { id: "exp-" + Math.random().toString(36).slice(2), who, category, amount: value, desc: (desc || "").trim(), date, projectId: selectedProjectId }
    setDocAndSave(d => { d.expenses = [...d.expenses, e]; return d })
    setWho(""); setCategory(""); setAmount(""); setDesc("")
  }
  function removeExpense(id) { setDocAndSave(d => { d.expenses = d.expenses.filter(e => e.id !== id); return d }) }

  /* ===================== Derivados por Projeto & Período ===================== */
  const projectExpenses = useMemo(() => expenses.filter(e => e.projectId === selectedProjectId), [expenses, selectedProjectId])

  // meses + "ALL" (Total do projeto)
  const months = useMemo(() => {
    const s = new Set(projectExpenses.map(e => monthKey(e.date)).filter(Boolean))
    if (!s.size) s.add(todayYYYYMM())
    return ["ALL", ...Array.from(s).sort().reverse()]
  }, [projectExpenses])

  const monthlyExpenses = useMemo(
    () => selectedMonth === "ALL" ? projectExpenses : projectExpenses.filter(e => monthKey(e.date) === selectedMonth),
    [projectExpenses, selectedMonth]
  )

  const filteredExpenses = useMemo(
    () => monthlyExpenses.filter(e =>
      (filterCat === "Todos" || e.category === filterCat) &&
      (filterWho === "Todos" || e.who === filterWho)
    ),
    [monthlyExpenses, filterCat, filterWho]
  )

  const total = useMemo(() => monthlyExpenses.reduce((s, e) => s + (Number.isFinite(e.amount) ? e.amount : 0), 0), [monthlyExpenses])

  // Totais por pessoa no período mostrado (monthlyExpenses)
  const paidBy = useMemo(() => {
    const map = {}
    for (const e of monthlyExpenses) {
      const v = Number.isFinite(e.amount) ? e.amount : 0
      map[e.who] = (map[e.who] || 0) + v
    }
    return map
  }, [monthlyExpenses])

  const perHead = useMemo(() => {
    const n = people.length || 1
    return total / n
  }, [people.length, total])

  // Totais por categoria no período mostrado
  const totalsByCategory = useMemo(() => {
    const map = {}
    for (const e of monthlyExpenses) {
      const v = Number.isFinite(e.amount) ? e.amount : 0
      map[e.category] = (map[e.category] || 0) + v
    }
    return map
  }, [monthlyExpenses])

  // Agrupado por categoria (aplica filtros Cat/Who)
  const groupedByCategory = useMemo(() => {
    const map = {}
    for (const e of filteredExpenses) {
      const v = Number.isFinite(e.amount) ? e.amount : 0
      map[e.category] = map[e.category] || { total: 0, items: [] }
      map[e.category].total += v
      map[e.category].items.push(e)
    }
    return map
  }, [filteredExpenses])

  // Acertos (quem deve para quem) no período mostrado
  const settlements = useMemo(() => {
    const saldo = {}
    for (const p of people) saldo[p] = (paidBy[p] || 0) - perHead
    const devedores = [], credores = []
    for (const p of people) {
      const v = Number(saldo[p] || 0)
      if (v < -0.009) devedores.push({ p, v: -v })
      else if (v > 0.009) credores.push({ p, v })
    }
    devedores.sort((a,b)=> b.v - a.v); credores.sort((a,b)=> b.v - a.v)
    const moves = []
    let i=0, j=0
    while (i < devedores.length && j < credores.length) {
      const d = devedores[i], c = credores[j]
      const x = Math.min(d.v, c.v)
      moves.push({ from: d.p, to: c.p, value: x })
      d.v -= x; c.v -= x
      if (d.v < 0.009) i++
      if (c.v < 0.009) j++
    }
    return moves
  }, [people, paidBy, perHead])

  const selectedPeriodLabel = selectedMonth === "ALL" ? "Total" : monthLabel(selectedMonth)

  /* ===================== Dados dos GRÁFICOS ===================== */
  const pieData = useMemo(() => {
    const map = {}
    for (const e of filteredExpenses) {
      const v = Number.isFinite(e.amount) ? e.amount : 0
      map[e.category] = (map[e.category] || 0) + v
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => Number.isFinite(d.value) && d.value > 0)
      .sort((a,b)=> b.value - a.value)
  }, [filteredExpenses])

  const lineData = useMemo(() => {
    const map = {}
    for (const e of projectExpenses) {
      if (filterCat !== "Todos" && e.category !== filterCat) continue
      if (filterWho !== "Todos" && e.who !== filterWho) continue
      const v = Number.isFinite(e.amount) ? e.amount : 0
      const m = monthKey(e.date)
      map[m] = (map[m] || 0) + v
    }
    return Object.entries(map)
      .filter(([m, v]) => m && Number.isFinite(v))
      .sort((a,b)=> a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }))
  }, [projectExpenses, filterCat, filterWho])

  /* ===================== UI ===================== */
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">Gastos em Família</h1>
            {selectedProject && (
              <span className={`px-2 py-0.5 text-xs rounded ${isClosed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {isClosed ? "Projeto fechado" : "Projeto aberto"}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {saving ? "Salvando…" : (lastSavedAt ? `Salvo às ${fmtHora(lastSavedAt)}` : "—")}
          </div>
          <button onClick={onSignOut} className="text-sm text-slate-600 hover:underline">Sair</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Projeto (o card de Família foi removido: slug é automático por e-mail) */}
        <section className="mb-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Projeto</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                <select
                  className="px-3 py-2 rounded-xl border min-w-[220px] w-full md:w-auto"
                  value={selectedProjectId}
                  onChange={(e)=>{
                    setSelectedProjectId(e.target.value)
                    if (slug) localStorage.setItem(`project:${slug}`, e.target.value)
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status==="closed" ? "(fechado)" : ""}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={()=>setShowNewProject(v=>!v)} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Novo</button>
                  <button onClick={closeCurrentProject} disabled={!selectedProject || isClosed} className={`px-3 py-2 rounded-xl border ${(!selectedProject || isClosed) ? "text-gray-400 border-gray-200" : ""}`}>Fechar</button>
                  <button onClick={reopenCurrentProject} disabled={!selectedProject || !isClosed} className={`px-3 py-2 rounded-xl border ${(!selectedProject || !isClosed) ? "text-gray-400 border-gray-200" : ""}`}>Reabrir</button>
                  <button onClick={deleteCurrentProject} disabled={!selectedProject} className={`px-3 py-2 rounded-xl border ${!selectedProject ? "text-gray-400 border-gray-200" : "text-red-700 border-red-200 hover:bg-red-50"}`}>Excluir</button>
                </div>
              </div>

              {showNewProject && (
                <div className="border rounded-xl p-3 bg-slate-50">
                  <div className="grid md:grid-cols-5 gap-3">
                    <div className="md:col-span-1">
                      <label className="block text-xs mb-1">Tipo</label>
                      <select value={newProjectType} onChange={(e)=>setNewProjectType(e.target.value)} className="w-full px-3 py-2 rounded-xl border">
                        <option value="monthly">Mensal</option>
                        <option value="trip">Viagem</option>
                        <option value="custom">Personalizado</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs mb-1">Nome</label>
                      <input value={newProjectName} onChange={(e)=>setNewProjectName(e.target.value)} placeholder="Ex.: 2025-09 ou Viagem Nordeste" className="w-full px-3 py-2 rounded-xl border" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs mb-1">Início</label>
                      <input type="date" value={newProjectStart} onChange={(e)=>setNewProjectStart(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs mb-1">Fim (opcional)</label>
                      <input type="date" value={newProjectEnd} onChange={(e)=>setNewProjectEnd(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
                    </div>
                    <div className="md:col-span-5 flex justify-end gap-2">
                      <button onClick={()=>setShowNewProject(false)} className="px-3 py-2 rounded-xl border">Cancelar</button>
                      <button onClick={createProject} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Criar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Período */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">Período — {selectedProject?.name || "—"}</h2>
          <div className="flex flex-wrap gap-2">
            {months.map(m => (
              <button
                key={m}
                onClick={()=>setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-full border ${selectedMonth===m ? "bg-slate-900 text-white border-slate-900" : ""}`}
              >
                {m === "ALL" ? "Total" : monthLabel(m)}
              </button>
            ))}
          </div>
        </section>

        {/* Pessoas / Categorias / Filtro */}
        <section className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Pessoas</h2>
            <TagEditor items={people} onAdd={addPerson} onRemove={removePerson} placeholder="Adicionar pessoa" />
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Categorias</h2>
            <TagEditor items={categories} onAdd={addCategory} onRemove={removeCategory} placeholder="Adicionar categoria" />
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Filtro</h2>

            <div className="mb-3">
              <div className="text-xs mb-1 text-slate-500">Categoria</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setFilterCat("Todos")} className={`px-3 py-1.5 rounded-full border ${filterCat==="Todos" ? "bg-slate-900 text-white border-slate-900" : ""}`}>Todos</button>
                {categories.map(c => (
                  <button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1.5 rounded-full border ${filterCat===c ? "bg-slate-900 text-white border-slate-900" : ""}`}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs mb-1 text-slate-500">Pessoa</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setFilterWho("Todos")} className={`px-3 py-1.5 rounded-full border ${filterWho==="Todos" ? "bg-slate-900 text-white border-slate-900" : ""}`}>Todos</button>
                {people.map(p => (
                  <button key={p} onClick={()=>setFilterWho(p)} className={`px-3 py-1.5 rounded-full border ${filterWho===p ? "bg-slate-900 text-white border-slate-900" : ""}`}>{p}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Nova despesa */}
        <section className="bg-white rounded-2xl shadow p-4 mt-4">
          <h2 className="font-semibold mb-3">Adicionar despesa {selectedProject ? `em ${selectedProject.name}` : ""}</h2>
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Quem pagou</label>
              <select value={who} onChange={(e)=>setWho(e.target.value)} className="w-full px-3 py-2 rounded-xl border" disabled={readOnly}>
                <option value="">Selecione</option>
                {people.map((p)=> <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Categoria</label>
              <select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border" disabled={readOnly}>
                <option value="">Selecione</option>
                {categories.map((c)=> <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Valor</label>
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="ex: 123,45" className="w-full px-3 py-2 rounded-xl border" disabled={readOnly} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Descrição</label>
              <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="ex: Mercado" className="w-full px-3 py-2 rounded-xl border" disabled={readOnly} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Data</label>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border" disabled={readOnly} />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button onClick={addExpense} disabled={!selectedProject || readOnly || !who || !category || !amount} className={`px-3 py-2 rounded-xl ${(!selectedProject || readOnly || !who || !category || !amount) ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white"}`}>
                Lançar
              </button>
            </div>
          </div>
        </section>

        {/* Lista + Resumos */}
        <section className="grid lg:grid-cols-3 gap-4 mt-4">
          {/* Esquerda: despesas agrupadas por categoria */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Despesas — {selectedPeriodLabel} {selectedProject ? `• ${selectedProject.name}` : ""}{" "}
                {filterCat!=="Todos" && <span className="text-slate-500">({filterCat})</span>}
                {filterWho!=="Todos" && <span className="text-slate-500"> • {filterWho}</span>}
              </h2>
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-500">Total: {currency(total)}</div>
                <button
                  onClick={()=>setSortOrder(prev => prev==="desc" ? "asc" : "desc")}
                  className="text-xs px-2 py-1 rounded border"
                  title="Alternar ordenação por data"
                >
                  Data: {sortOrder==="desc" ? "recente → antigo" : "antigo → recente"}
                </button>
              </div>
            </div>

            {Object.keys(groupedByCategory).length === 0 ? (
              <p className="text-sm text-slate-500">Sem despesas no período (ou com o filtro aplicado).</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory)
                  .sort((a,b)=> b[1].total - a[1].total)
                  .map(([cat, group], idx) => {
                    const itemsSorted = [...group.items].sort((a,b)=>{
                      if (a.date === b.date) return 0
                      if (sortOrder === "desc") return a.date > b.date ? -1 : 1
                      return a.date > b.date ? 1 : -1
                    })
                    return (
                      <div key={cat} className={idx>0 ? "pt-4 mt-4 border-t border-slate-200" : ""}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{cat}</h3>
                          <div className="font-semibold">{currency(group.total)}</div>
                        </div>
                        <ul className="divide-y mt-2">
                          {itemsSorted.map((e) => (
                            <li key={e.id} className="py-2 flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="font-medium">{e.desc || e.category}</div>
                                <div className="text-xs text-slate-500">
                                  {e.who} • {new Date(e.date).toLocaleDateString("pt-BR")}
                                </div>
                              </div>
                              <div className="w-28 text-right font-semibold">{currency(e.amount)}</div>
                              <button onClick={()=>removeExpense(e.id)} className={`text-xs ${readOnly?"text-gray-400":"text-red-600 hover:underline"}`}>remover</button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Direita: Resumos do período */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-6">
            <div className="rounded-xl border p-3 bg-slate-50">
              <h3 className="font-semibold mb-1">{selectedMonth==="ALL" ? "Total do período (projeto inteiro)" : "Total do mês"}</h3>
              <div className="text-2xl font-bold">{currency(total)}</div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Quem pagou quanto (rateio)</h3>
              {people.length === 0 ? (
                <p className="text-sm text-slate-500">Cadastre as pessoas para ver o rateio.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {people.map(p => (
                    <li key={p} className="flex justify-between">
                      <span>
                        <b>{p}</b> — pagou {currency(paidBy[p] || 0)} • quota {currency(perHead)}{" "}
                        <span className={((paidBy[p] || 0) - perHead) >= 0 ? "text-emerald-600" : "text-red-600"}>
                          ({((paidBy[p] || 0) - perHead >= 0 ? "+" : "") + currency((paidBy[p] || 0) - perHead)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Totais por categoria ({selectedPeriodLabel})</h3>
              {Object.keys(totalsByCategory).length === 0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {Object.entries(totalsByCategory)
                    .sort((a,b)=> b[1] - a[1])
                    .map(([cat, val]) => (
                      <li key={cat} className="flex justify-between">
                        <span>{cat}</span>
                        <span className="font-semibold">{currency(val)}</span>
                      </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Acertos ({selectedPeriodLabel})</h3>
              {settlements.length === 0 ? (
                <p className="text-sm text-slate-500">Ninguém deve ninguém (ou faltam lançamentos).</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {settlements.map((m, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span><b>{m.from}</b> deve para <b>{m.to}</b></span>
                      <span className="font-semibold">{currency(m.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ===================== Painel: GRÁFICOS ===================== */}
        <section className="bg-white rounded-2xl shadow p-4 mt-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-semibold">Gráficos — {selectedProject?.name || "—"}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={()=>setChartType("pie")}
                className={`px-3 py-1.5 rounded-full border ${chartType==="pie" ? "bg-slate-900 text-white border-slate-900" : ""}`}
                title="Distribuição por categoria no período filtrado"
              >
                Pizza
              </button>
              <button
                onClick={()=>setChartType("line")}
                className={`px-3 py-1.5 rounded-full border ${chartType==="line" ? "bg-slate-900 text-white border-slate-900" : ""}`}
                title="Evolução mensal do projeto (com filtros aplicados)"
              >
                Linha
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500 mb-3">
            {chartType==="pie"
              ? <>Categorias de <b>{selectedPeriodLabel}</b> {filterCat!=="Todos" && <>• categoria: <b>{filterCat}</b></>} {filterWho!=="Todos" && <>• pessoa: <b>{filterWho}</b></>} </>
              : <>Total mensal do projeto (filtros aplicados • {filterCat} • {filterWho})</>
            }
          </div>

          <ChartsErrorBoundary>
            {!isMounted ? (
              <div className="h-72 grid place-items-center text-sm text-slate-500">Carregando gráfico…</div>
            ) : chartType === "pie" ? (
              pieData.length === 0 ? (
                <div className="h-72 grid place-items-center text-sm text-slate-500">Sem dados para o gráfico de pizza.</div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip formatter={(val)=>currency(Number(val))} />
                      <Legend />
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                        {pieData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={colorFor(entry.name)} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              lineData.length === 0 ? (
                <div className="h-72 grid place-items-center text-sm text-slate-500">Sem dados para o gráfico de linha.</div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(val)=>currency(Number(val))} />
                      <Legend />
                      <Line type="monotone" dataKey="total" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            )}
          </ChartsErrorBoundary>
        </section>

        <footer className="text-center text-xs text-slate-500 pt-6">
          Seus dados agora carregam automaticamente pelo seu <b>login</b>. Em breve: <b>convites</b> por e-mail e <b>papéis</b> por projeto.
        </footer>
      </div>
    </div>
  )
}

/* ===================== Componentes ===================== */
function TagEditor({ items, onAdd, onRemove, placeholder }) {
  const [val, setVal] = useState("")
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          className="px-3 py-2 rounded-xl border w-full"
          placeholder={placeholder}
          value={val}
          onChange={(e)=>setVal(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==="Enter"){ onAdd(val); setVal("") } }}
        />
        <button className="px-3 py-2 rounded-xl border" onClick={()=>{ onAdd(val); setVal("") }}>Adicionar</button>
      </div>
      {items?.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map(it => (
            <li key={it} className="px-2 py-1 rounded-full border bg-slate-50 flex items-center gap-2">
              <span className="text-sm">{it}</span>
              <button className="text-xs text-red-700" onClick={()=>onRemove(it)}>×</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-slate-500 mt-2">Nenhum item ainda.</div>
      )}
    </div>
  )
}
