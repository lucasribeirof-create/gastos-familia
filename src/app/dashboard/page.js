// src/app/dashboard/page.js
"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

/* ===================== Helpers ===================== */
const currency = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) } catch { return "" } }
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const firstDayOfMonth = (yyyyMM) => `${yyyyMM}-01`

/* ===================== Page (proteção por login) ===================== */
export default function Page() {
  const { status, data: session } = useSession()
  const router = useRouter()
  useEffect(() => { if (status === "unauthenticated") router.replace("/") }, [status, router])
  if (status !== "authenticated") return <main style={{display:"grid",placeItems:"center",height:"100vh"}}>Carregando…</main>
  return <GastosApp user={session.user} onSignOut={() => signOut()} />
}

/* ===================== App ===================== */
function GastosApp({ user, onSignOut }) {
  // ----- Família (slug) -----
  const [slugInput, setSlugInput] = useState("")
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // ----- Documento (nuvem) -----
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState(["Mercado", "Carro", "Aluguel", "Lazer"])
  const [projects, setProjects] = useState([]) // {id,name,type,start,end,status}
  const [expenses, setExpenses] = useState([]) // { ..., projectId }

  // ----- Projeto atual -----
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])
  const readOnly = selectedProject?.status === "closed"

  // ----- Inputs de criação de projeto -----
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectType, setNewProjectType] = useState("monthly") // monthly | trip | custom
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectStart, setNewProjectStart] = useState(firstDayOfMonth(todayYYYYMM()))
  const [newProjectEnd, setNewProjectEnd] = useState("")

  // ----- Inputs e filtros de despesas -----
  const [newPerson, setNewPerson] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [filterCat, setFilterCat] = useState("Todos")
  const [selectedMonth, setSelectedMonth] = useState(todayYYYYMM())

  /* ===================== Carregamento inicial ===================== */
  useEffect(() => {
    const storedSlug = typeof window !== "undefined" ? localStorage.getItem("familySlug") : ""
    const initialSlug = storedSlug || ""
    setSlug(initialSlug)
    setSlugInput(initialSlug)

    async function boot(s) {
      setLoading(true); setError("")
      try {
        const doc = await carregarFamilia(s)
        setPeople(doc.people || [])
        setCategories(doc.categories || ["Mercado","Carro","Aluguel","Lazer"])
        setProjects(doc.projects || [])
        setExpenses(doc.expenses || [])
        if (doc.updatedAt) setLastSavedAt(doc.updatedAt)

        // escolher projeto inicial
        const storageKey = `project:${s}`
        const storedPid = localStorage.getItem(storageKey)
        const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid))
          ? storedPid
          : (doc.projects.find(p => p.status === "open")?.id || doc.projects[0]?.id || "")
        setSelectedProjectId(pid)
        if (pid) localStorage.setItem(storageKey, pid)

        // mês default: do projeto ou atual
        setSelectedMonth(todayYYYYMM())
      } catch(e) {
        setError(String(e.message || e))
      } finally {
        setLoading(false)
      }
    }

    if (initialSlug) boot(initialSlug); else setLoading(false)
  }, [])

  /* ===================== Trocar/definir família ===================== */
  const aplicarSlug = useCallback(async () => {
    const s = slugInput.trim().toLowerCase()
    if (!s) return
    setSlug(s); localStorage.setItem("familySlug", s)
    setLoading(true); setError("")
    try {
      const doc = await carregarFamilia(s)
      setPeople(doc.people || [])
      setCategories(doc.categories || ["Mercado","Carro","Aluguel","Lazer"])
      setProjects(doc.projects || [])
      setExpenses(doc.expenses || [])
      setLastSavedAt(doc.updatedAt || null)

      const storageKey = `project:${s}`
      const storedPid = localStorage.getItem(storageKey)
      const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid))
        ? storedPid
        : (doc.projects.find(p => p.status === "open")?.id || doc.projects[0]?.id || "")
      setSelectedProjectId(pid)
      if (pid) localStorage.setItem(storageKey, pid)

      setSelectedMonth(todayYYYYMM())
    } catch(e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [slugInput])

  /* ===================== Autosave (debounce) ===================== */
  const saveTimer = useRef(null)
  const queueSave = useCallback((next) => {
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

  const retrySave = useCallback(async () => {
    if (!slug) return
    setSaving(true); setError("")
    try {
      const res = await salvarFamilia(slug, { people, categories, projects, expenses })
      setLastSavedAt(res?.updatedAt || new Date().toISOString())
    } catch(e) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }, [slug, people, categories, projects, expenses])

  const setDocAndSave = useCallback((updater) => {
    const next = { people, categories, projects, expenses }
    updater(next)
    setPeople(next.people)
    setCategories(next.categories)
    setProjects(next.projects)
    setExpenses(next.expenses)
    queueSave(next)
  }, [people, categories, projects, expenses, queueSave])

  /* ===================== Projetos ===================== */
  const changeProject = useCallback((pid) => {
    setSelectedProjectId(pid)
    if (slug) localStorage.setItem(`project:${slug}`, pid)
    // ao trocar projeto, mantemos selectedMonth; se não houver despesas nesse mês, tudo bem
  }, [slug])

  const openProjects = useMemo(() => projects.filter(p => p.status === "open"), [projects])

  function createProject() {
    // validação simples
    const name = (newProjectName || "").trim()
    let finalName = name
    let start = newProjectStart || ""
    let end = newProjectEnd || null
    let type = newProjectType

    if (type === "monthly") {
      // se não informou nome, usa AAAA-MM
      finalName = finalName || todayYYYYMM()
      start = firstDayOfMonth(finalName.match(/^\d{4}-\d{2}$/) ? finalName : todayYYYYMM())
      end = null
    } else if (type === "custom") {
      if (!finalName) finalName = "Projeto"
    } else if (type === "trip") {
      if (!finalName) finalName = "Viagem"
    }

    const proj = {
      id: `proj-${crypto.randomUUID()}`,
      name: finalName,
      type,
      start: start || new Date().toISOString().slice(0,10),
      end: end || null,
      status: "open",
    }

    setDocAndSave(d => {
      d.projects = [proj, ...d.projects]
    })
    setSelectedProjectId(proj.id)
    if (slug) localStorage.setItem(`project:${slug}`, proj.id)

    // limpar form
    setShowNewProject(false)
    setNewProjectName("")
    setNewProjectStart(firstDayOfMonth(todayYYYYMM()))
    setNewProjectEnd("")
    setNewProjectType("monthly")
  }

  function closeCurrentProject() {
    if (!selectedProject) return
    const ok = confirm(`Fechar o projeto "${selectedProject.name}"? Você não poderá lançar/editar enquanto estiver fechado.`)
    if (!ok) return
    setDocAndSave(d => {
      d.projects = d.projects.map(p => p.id === selectedProject.id ? { ...p, status: "closed", end: p.end || new Date().toISOString().slice(0,10) } : p)
    })
  }

  /* ===================== Ações Pessoas/Categorias/Despesas ===================== */
  function addPerson() {
    if (readOnly) return
    const name = newPerson.trim()
    if (!name || people.includes(name)) return
    setDocAndSave(d => { d.people = [...d.people, name] })
    setNewPerson("")
    if (!who) setWho(name)
  }
  function removePerson(name) {
    if (readOnly) return
    if (!people.includes(name)) return
    setDocAndSave(d => {
      d.people = d.people.filter(p => p !== name)
      d.expenses = d.expenses.filter(e => e.who !== name)
    })
    if (who === name) setWho("")
  }

  function addCategory() {
    if (readOnly) return
    const cat = newCategory.trim()
    if (!cat || categories.includes(cat)) return
    setDocAndSave(d => { d.categories = [...d.categories, cat] })
    setNewCategory("")
    if (!category) setCategory(cat)
  }
  function removeCategory(cat) {
    if (readOnly) return
    if (!categories.includes(cat)) return
    const ok = confirm(`Remover a categoria "${cat}"? Todas as despesas dessa categoria (em todos os projetos) serão apagadas.`)
    if (!ok) return
    setDocAndSave(d => {
      d.categories = d.categories.filter(c => c !== cat)
      d.expenses = d.expenses.filter(e => e.category !== cat)
    })
    if (filterCat === cat) setFilterCat("Todos")
    if (category === cat) setCategory("")
  }

  function addExpense() {
    if (!selectedProject || readOnly) return
    const amt = Number(String(amount).replace(",", "."))
    if (!who || !category || !amt || isNaN(amt)) return
    const e = { id: crypto.randomUUID(), who, category, amount: amt, desc: desc.trim(), date, projectId: selectedProject.id }
    setDocAndSave(d => { d.expenses = [e, ...d.expenses] })
    setAmount(""); setDesc("")
    const mk = monthKey(date); if (mk && mk !== selectedMonth) setSelectedMonth(mk)
  }
  function removeExpense(id) {
    if (readOnly) return
    setDocAndSave(d => { d.expenses = d.expenses.filter(e => e.id !== id) })
  }

  function resetAll() {
    if (readOnly) return
    if (!confirm("Apagar TODOS os dados desta família na nuvem? (todos os projetos)")) return
    const cleared = {
      people: [],
      categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
      projects,
      expenses: [],
    }
    setPeople(cleared.people); setCategories(cleared.categories); setExpenses(cleared.expenses)
    queueSave({ ...cleared, projects })
    setWho(""); setCategory(""); setAmount(""); setDesc("")
  }

  /* ===================== Derivados por Projeto + Mês ===================== */
  const projectExpenses = useMemo(
    () => expenses.filter(e => e.projectId === selectedProjectId),
    [expenses, selectedProjectId]
  )

  const months = useMemo(() => {
    const s = new Set(projectExpenses.map(e => monthKey(e.date)).filter(Boolean))
    if (!s.size) s.add(todayYYYYMM())
    return Array.from(s).sort().reverse()
  }, [projectExpenses])

  const monthlyExpenses = useMemo(
    () => projectExpenses.filter(e => monthKey(e.date) === selectedMonth),
    [projectExpenses, selectedMonth]
  )

  const filteredExpenses = useMemo(
    () => monthlyExpenses.filter(e => filterCat === "Todos" || e.category === filterCat),
    [monthlyExpenses, filterCat]
  )

  const total = useMemo(() => monthlyExpenses.reduce((s, e) => s + e.amount, 0), [monthlyExpenses])
  const perHead = useMemo(() => (people.length > 0 ? total / people.length : 0), [people.length, total])

  const paidBy = useMemo(() => {
    const map = {}; people.forEach(p => (map[p] = 0))
    monthlyExpenses.forEach(e => { map[e.who] = (map[e.who] || 0) + e.amount })
    return map
  }, [monthlyExpenses, people])

  const balances = useMemo(
    () => people.map((p) => ({ person: p, balance: (paidBy[p] || 0) - perHead })),
    [people, paidBy, perHead]
  )

  const settlements = useMemo(() => {
    const debtors = balances.filter(b => b.balance < -0.01).map(b => ({ person: b.person, value: -b.balance }))
    const creditors = balances.filter(b => b.balance > 0.01).map(b => ({ person: b.person, value: b.balance }))
    const moves = []; let i=0,j=0
    while (i<debtors.length && j<creditors.length) {
      const pay = Math.min(debtors[i].value, creditors[j].value)
      moves.push({ from: debtors[i].person, to: creditors[j].person, value: pay })
      debtors[i].value -= pay; creditors[j].value -= pay
      if (debtors[i].value <= 0.01) i++; if (creditors[j].value <= 0.01) j++
    }
    return moves
  }, [balances])

  const groupedByCategory = useMemo(() => {
    const map = {}
    filteredExpenses.forEach(e => {
      if (!map[e.category]) map[e.category] = { total: 0, items: [] }
      map[e.category].total += e.amount
      map[e.category].items.push(e)
    })
    return map
  }, [filteredExpenses])

  const totalsByCategory = useMemo(() => {
    const m = {}
    monthlyExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount })
    return m
  }, [monthlyExpenses])

  /* ===================== UI ===================== */
  if (!slug) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-5 space-y-4">
          <h1 className="text-xl font-bold">Conectar à família</h1>
          <p className="text-sm text-slate-600">Digite um código (ex.: <b>familia-ribeiro</b>). Quem usar o mesmo código verá os mesmos dados.</p>
          <input value={slugInput} onChange={(e)=>setSlugInput(e.target.value)} placeholder="ex.: familia-ribeiro" className="w-full px-3 py-2 rounded-xl border" />
          <button onClick={aplicarSlug} className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white">Usar este código</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </main>
    )
  }

  if (loading) return <main className="min-h-screen grid place-items-center">Carregando dados…</main>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gastos em Família</h1>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Família: <b>{slug}</b></span>
              {saving && <span className="text-emerald-600">salvando…</span>}
              {!saving && lastSavedAt && <span>Último salvo às {fmtHora(lastSavedAt)}</span>}
              {error && <span className="text-red-600">erro: {error}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden sm:block">{user?.name}</span>
            <input value={slugInput} onChange={(e)=>setSlugInput(e.target.value)} placeholder="trocar família…" className="px-3 py-2 rounded-xl border hidden md:block" style={{minWidth:220}} />
            <button onClick={aplicarSlug} className="px-3 py-2 rounded-2xl border text-sm hidden md:inline-flex">Trocar família</button>
            {error && <button onClick={retrySave} className="px-3 py-2 rounded-2xl bg-yellow-100 text-yellow-800 text-sm">Tentar novamente</button>}
            <button onClick={resetAll} disabled={readOnly} className={`px-3 py-2 rounded-2xl text-sm ${readOnly?"bg-gray-100 text-gray-400":"bg-red-100 text-red-700 hover:bg-red-200"}`}>Limpar tudo</button>
            <button onClick={onSignOut} className="px-3 py-2 rounded-2xl border text-sm">Sair</button>
          </div>
        </header>

        {/* Projetos */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="space-y-1">
                <label className="block text-xs">Projeto atual</label>
                <select
                  value={selectedProjectId}
                  onChange={(e)=>changeProject(e.target.value)}
                  className="px-3 py-2 rounded-xl border min-w-[220px]"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.status==="closed" ? "(fechado)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {selectedProject && selectedProject.status === "closed" && (
                <span className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-600">Projeto fechado (somente leitura)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={()=>setShowNewProject(v=>!v)}
                className="px-3 py-2 rounded-xl bg-blue-600 text-white"
              >
                Novo projeto
              </button>
              <button
                onClick={closeCurrentProject}
                disabled={!selectedProject || readOnly}
                className={`px-3 py-2 rounded-xl border ${(!selectedProject || readOnly) ? "text-gray-400 border-gray-200" : ""}`}
                title={readOnly ? "Já está fechado" : "Fechar projeto atual"}
              >
                Fechar projeto
              </button>
            </div>
          </div>

          {showNewProject && (
            <div className="mt-4 p-4 rounded-xl border grid md:grid-cols-5 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs mb-1">Tipo</label>
                <select value={newProjectType} onChange={e=>setNewProjectType(e.target.value)} className="w-full px-3 py-2 rounded-xl border">
                  <option value="monthly">Mensal</option>
                  <option value="trip">Viagem</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-1">Nome</label>
                <input value={newProjectName} onChange={(e)=>setNewProjectName(e.target.value)} placeholder={newProjectType==="monthly"?"AAAA-MM (ex.: 2025-09)":"ex.: Viagem Nordeste"} className="w-full px-3 py-2 rounded-xl border" />
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
          )}
        </section>

        {/* Mês (dentro do projeto) */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">Período (mês) — {selectedProject?.name || "—"}</h2>
          <div className="flex flex-wrap gap-2">
            {months.map(m => (
              <button
                key={m}
                onClick={()=>setSelectedMonth(m)}
                className={`px-3 py-1 rounded-full text-sm border ${selectedMonth===m ? "bg-blue-600 text-white border-blue-600" : "bg-white"}`}
                title={`Ver despesas de ${monthLabel(m)}`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        </section>

        {/* Pessoas & Categorias */}
        <section className="grid md:grid-cols-2 gap-4">
          {/* Pessoas */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">1) Pessoas do grupo</h2>
            <div className="flex gap-2 mb-3">
              <input value={newPerson} onChange={(e)=>setNewPerson(e.target.value)} placeholder="Nome (ex.: Ana)" className="flex-1 px-3 py-2 rounded-xl border" disabled={readOnly} />
              <button onClick={addPerson} disabled={readOnly} className={`px-4 py-2 rounded-xl ${readOnly?"bg-gray-200 text-gray-500":"bg-blue-600 text-white"}`}>Adicionar</button>
            </div>
            {people.length === 0 ? (
              <p className="text-sm text-slate-500">Adicione pelo menos 2 pessoas.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <li key={p} className="px-2 py-1 bg-slate-100 rounded-full text-sm flex items-center gap-2">
                    <span className="pl-1">{p}</span>
                    <button onClick={()=>removePerson(p)} disabled={readOnly} className={`w-6 h-6 grid place-items-center rounded-full ${readOnly?"text-gray-400":"text-slate-500 hover:text-red-600 hover:bg-red-50"}`} title={`Remover ${p}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Categorias */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">2) Categorias</h2>
            <div className="flex gap-2 mb-3">
              <input value={newCategory} onChange={(e)=>setNewCategory(e.target.value)} placeholder="Nova categoria (ex.: Remédios)" className="flex-1 px-3 py-2 rounded-xl border" disabled={readOnly} />
              <button onClick={addCategory} disabled={readOnly} className={`px-4 py-2 rounded-xl ${readOnly?"bg-gray-200 text-gray-500":"bg-emerald-600 text-white"}`}>Adicionar</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Todos", ...categories].map((c) => (
                <button
                  key={c}
                  onClick={()=>setFilterCat(c)}
                  className={`px-3 py-1 rounded-full text-sm border relative pr-7 ${filterCat===c ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}
                  title={c==="Todos"?"Mostrar todas":`Filtrar por ${c}`}
                >
                  {c}
                  {c!=="Todos" && (
                    <span
                      onClick={(e)=>{ e.stopPropagation(); removeCategory(c) }}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full text-xs ${filterCat===c ? "hover:bg-emerald-700" : "hover:bg-slate-100"}`}
                      title={`Remover categoria ${c}`}
                      role="button"
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Nova despesa */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">3) Adicionar despesa {selectedProject ? `em ${selectedProject.name}` : ""}</h2>
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
              <label className="block text-xs mb-1">Valor (R$)</label>
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0,00" className="w-full px-3 py-2 rounded-xl border" inputMode="decimal" disabled={readOnly} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Descrição</label>
              <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Ex.: feira do mês" className="w-full px-3 py-2 rounded-xl border" disabled={readOnly} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Data</label>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border" disabled={readOnly} />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button onClick={addExpense} disabled={!selectedProject || readOnly} className={`px-5 py-2 rounded-xl ${(!selectedProject || readOnly) ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white"}`}>
                Lançar
              </button>
            </div>
          </div>
        </section>

        {/* Lista (agrupada por categoria) + Resumos */}
        <section className="grid lg:grid-cols-3 gap-4">
          {/* Esquerda: despesas agrupadas por categoria (mês + filtro) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">
              Despesas de {monthLabel(selectedMonth)} {selectedProject ? `— ${selectedProject.name}` : ""} {filterCat!=="Todos" && <span className="text-slate-500">({filterCat})</span>}
            </h2>

            {Object.keys(groupedByCategory).length === 0 ? (
              <p className="text-sm text-slate-500">Sem despesas neste mês (ou no filtro aplicado).</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory)
                  .sort((a,b)=> b[1].total - a[1].total)
                  .map(([cat, group]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{cat}</h3>
                      <div className="font-semibold">{currency(group.total)}</div>
                    </div>
                    <ul className="divide-y mt-2">
                      {group.items.map((e) => (
                        <li key={e.id} className="py-2 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{e.desc || e.category}</div>
                            <div className="text-xs text-slate-500">
                              {e.who} • {new Date(e.date).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <div className="w-28 text-right font-semibold">{currency(e.amount)}</div>
                          <button onClick={()=>removeExpense(e.id)} disabled={readOnly} className={`text-sm ${readOnly?"text-gray-400":"text-red-600 hover:underline"}`}>
                            remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Direita: Resumo geral do mês + totais por categoria */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <h2 className="font-semibold mb-2">Resumo de {monthLabel(selectedMonth)}</h2>
              <div className="text-sm flex justify-between"><span>Total do mês</span><span className="font-semibold">{currency(total)}</span></div>
              <div className="text-sm flex justify-between"><span>Por pessoa ({people.length || 0})</span><span className="font-semibold">{currency(perHead || 0)}</span></div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Quem pagou quanto (mês)</h3>
              {people.length === 0 ? (
                <p className="text-sm text-slate-500">Adicione pessoas para ver o resumo.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {people.map((p) => (
                    <li key={p} className="flex justify-between">
                      <span>{p}</span>
                      <span>
                        {currency(paidBy[p] || 0)}{" "}
                        <span className={(paidBy[p] || 0) - perHead >= 0 ? "text-emerald-600" : "text-red-600"}>
                          ({((paidBy[p] || 0) - perHead >= 0 ? "+" : "") + currency((paidBy[p] || 0) - perHead)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Totais por categoria (mês)</h3>
              {Object.keys(totalsByCategory).length === 0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos neste mês.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {Object.entries(totalsByCategory).sort((a,b)=> b[1]-a[1]).map(([cat, val]) => (
                    <li key={cat} className="flex justify-between">
                      <span>{cat}</span>
                      <span className="font-semibold">{currency(val)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Acertos (mês)</h3>
              {settlements.length === 0 ? (
                <p className="text-sm text-slate-500">Ninguém deve ninguém (ou ainda faltam lançamentos).</p>
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

        <footer className="text-center text-xs text-slate-500 pt-6">
          Dica: use o mesmo <b>código da família</b> em aparelhos diferentes e organize por <b>Projetos</b> (mês, viagem, etc).
        </footer>
      </div>
    </div>
  )
}
