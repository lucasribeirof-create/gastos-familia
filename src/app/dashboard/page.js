"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

/* ===================== Helpers ===================== */
const currency = (v) => {
  if (typeof v !== "number" || Number.isNaN(v)) return "R$ 0,00"
  try { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
  catch { return `R$ ${v.toFixed(2)}` }
}
const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) } catch { return "" } }
const todayYYYYMMDD = () => new Date().toISOString().slice(0,10)
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const uid = () => Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10)

/** Parser robusto para BRL: aceita "1.234,56", "1234,56", "123456" etc. */
function parseBRL(input) {
  if (typeof input !== "string") input = String(input ?? "")
  const digits = input.replace(/[^\d]/g, "")
  if (!digits) return 0
  const int = digits.slice(0, -2) || "0"
  const cents = digits.slice(-2).padStart(2, "0")
  return Number(int + "." + cents)
}

/* ===================== Tipos & defaults ===================== */
const defaultDoc = {
  people: [],
  categories: [],
  projects: [],
  expenses: [],
  createdAt: null,
  updatedAt: null,
}

/* ===================== Página ===================== */
export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [slug, setSlug] = useState("")
  const [doc, setDoc] = useState(defaultDoc)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState({ status: "idle", at: null, error: "" }) // idle|saving|error|ok
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [showNewProject, setShowNewProject] = useState(false)

  // Inputs de nova despesa
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(todayYYYYMMDD())

  // debounce save
  const saveTimer = useRef(null)
  const lastSavedDocRef = useRef(null)

  /* ========= Redireciona se não logado ========= */
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/")
  }, [status, router])

  /* ========= Bootstrap slug ========= */
  useEffect(() => {
    try {
      const s = localStorage.getItem("family:slug") || ""
      if (s) setSlug(s)
    } catch {}
  }, [])

  /* ========= Carregar doc ========= */
  const loadDoc = useCallback(async (s) => {
    if (!s) return
    setLoading(true)
    setLoadError("")
    try {
      const data = await carregarFamilia(s)
      const doc = data || { ...defaultDoc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

      // se não há projetos, cria um mensal do mês atual
      if (!doc.projects?.length) {
        const yyyyMM = monthKey(todayYYYYMMDD())
        const p = {
          id: "proj-" + uid(),
          name: yyyyMM,
          type: "monthly",
          start: `${yyyyMM}-01`,
          end: null,
          status: "open",
        }
        doc.projects = [p]
        doc.expenses = doc.expenses || []
      }

      setDoc(doc)
      lastSavedDocRef.current = JSON.stringify(doc)

      // restaura projeto selecionado
      let pid = ""
      try { pid = localStorage.getItem(`project:${s}`) || "" } catch {}
      const ok = doc.projects.find(p => p.id === pid)
      setSelectedProjectId(ok ? pid : doc.projects[0]?.id || "")
    } catch (err) {
      setLoadError(err?.message || "Erro ao carregar")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (slug) loadDoc(slug) }, [slug, loadDoc])

  /* ========= Salvar com debounce ========= */
  const doSaveNow = useCallback(async (nextDoc) => {
    if (!slug) return
    setSaveState({ status: "saving", at: new Date().toISOString(), error: "" })
    try {
      await salvarFamilia(slug, nextDoc)
      lastSavedDocRef.current = JSON.stringify(nextDoc)
      setSaveState({ status: "ok", at: new Date().toISOString(), error: "" })
    } catch (err) {
      setSaveState({ status: "error", at: new Date().toISOString(), error: err?.message || "Falha ao salvar" })
    }
  }, [slug])

  const scheduleSave = useCallback((nextDoc) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { doSaveNow(nextDoc) }, 800)
  }, [doSaveNow])

  const setDocAndSave = useCallback((updater) => {
    setDoc(prev => {
      const draft = structuredClone(prev)
      const res = typeof updater === "function" ? updater(draft) : updater
      const next = res ?? draft
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  /* ========= Seleção/Criação de família ========= */
  const handleSetSlug = () => {
    if (!slug.trim()) return
    try { localStorage.setItem("family:slug", slug) } catch {}
    loadDoc(slug)
  }

  /* ========= Projetos ========= */
  const projects = doc.projects || []
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])
  const isClosed = selectedProject?.status === "closed"
  const readOnly = false // <— PROJETO FECHADO CONTINUA EDITÁVEL

  const createProject = (type, name, start, end = null) => {
    const p = { id: "proj-" + uid(), name, type, start, end, status: "open" }
    setDocAndSave(d => {
      d.projects.push(p)
    })
    setSelectedProjectId(p.id)
    try { if (slug) localStorage.setItem(`project:${slug}`, p.id) } catch {}
    setShowNewProject(false)
  }

  const closeCurrentProject = () => {
    if (!selectedProject) return
    const ok = confirm(`Fechar o projeto "${selectedProject.name}"?`)
    if (!ok) return
    setDocAndSave(d => {
      d.projects = d.projects.map(p => p.id === selectedProject.id ? { ...p, status: "closed", end: todayYYYYMMDD() } : p)
    })
  }

  const reopenCurrentProject = () => {
    if (!selectedProject) return
    const ok = confirm(`Reabrir o projeto "${selectedProject.name}"?`)
    if (!ok) return
    setDocAndSave(d => {
      d.projects = d.projects.map(p => p.id === selectedProject.id ? { ...p, status: "open", end: null } : p)
    })
  }

  const deleteCurrentProject = () => {
    if (!selectedProject) return
    const ok = confirm(`Excluir o projeto "${selectedProject.name}"?\nTodas as DESPESAS desse projeto serão apagadas. Esta ação não pode ser desfeita.`)
    if (!ok) return
    const next = projects.find(p => p.id !== selectedProject.id) || null
    setDocAndSave(d => {
      d.expenses = (d.expenses || []).filter(e => e.projectId !== selectedProject.id)
      d.projects  = (d.projects || []).filter(p => p.id !== selectedProject.id)
    })
    setSelectedProjectId(next?.id || "")
    try { if (slug) localStorage.setItem(`project:${slug}`, next?.id || "") } catch {}
  }

  /* ========= Pessoas & Categorias ========= */
  const addPerson = (name) => {
    name = (name || "").trim()
    if (!name) return
    if (doc.people.includes(name)) return
    setDocAndSave(d => { d.people.push(name) })
  }
  const removePerson = (name) => {
    if (!confirm(`Remover a pessoa "${name}"? As despesas dela serão apagadas.`)) return
    setDocAndSave(d => {
      d.people = d.people.filter(p => p !== name)
      d.expenses = d.expenses.filter(e => e.who !== name)
    })
  }

  const addCategory = (name) => {
    name = (name || "").trim()
    if (!name) return
    if (doc.categories.includes(name)) return
    setDocAndSave(d => { d.categories.push(name) })
  }
  const removeCategory = (name) => {
    if (!selectedProject) {
      if (!confirm(`Remover a categoria "${name}" de TODOS os projetos? (Todas as despesas com essa categoria serão apagadas)`)) return
      setDocAndSave(d => {
        d.categories = d.categories.filter(c => c !== name)
        d.expenses = d.expenses.filter(e => e.category !== name)
      })
      return
    }
    // Pergunta escopo
    const choice = prompt(
      `Remover a categoria "${name}"\n` +
      `Digite:\n` +
      `1 = Remover SOMENTE do projeto atual (${selectedProject.name})\n` +
      `2 = Remover de TODOS os projetos`
    )
    if (choice === "1") {
      setDocAndSave(d => {
        d.categories = d.categories.filter(c => c !== name)
        d.expenses = d.expenses.filter(e => !(e.category === name && e.projectId === selectedProject.id))
      })
    } else if (choice === "2") {
      setDocAndSave(d => {
        d.categories = d.categories.filter(c => c !== name)
        d.expenses = d.expenses.filter(e => e.category !== name)
      })
    }
  }

  /* ========= Despesas ========= */
  const addExpense = () => {
    if (readOnly) return
    if (!selectedProject) return alert("Crie/Selecione um projeto.")
    const amt = parseBRL(amount)
    if (!who || !category || !amt || amt <= 0) return
    const e = {
      id: "exp-" + uid(),
      who, category,
      amount: amt,
      desc: (desc || "").trim(),
      date: date || todayYYYYMMDD(),
      projectId: selectedProject.id,
      createdAt: new Date().toISOString(),
    }
    setDocAndSave(d => { d.expenses.push(e) })
    setAmount(""); setDesc("")
  }

  const removeExpense = (id) => {
    if (readOnly) return
    setDocAndSave(d => { d.expenses = d.expenses.filter(e => e.id !== id) })
  }

  /* ========= Derivados ========= */
  const people = doc.people || []
  const categories = doc.categories || []
  const expensesCurrent = useMemo(() => {
    const all = doc.expenses || []
    if (!selectedProject) return []
    return all.filter(e => e.projectId === selectedProject.id)
  }, [doc.expenses, selectedProject])

  const totalsByCategory = useMemo(() => {
    const acc = {}
    for (const e of expensesCurrent) {
      acc[e.category] = (acc[e.category] || 0) + (e.amount || 0)
    }
    return acc
  }, [expensesCurrent])

  const groupedByCategory = useMemo(() => {
    const map = {}
    for (const e of expensesCurrent) {
      if (!map[e.category]) map[e.category] = { total: 0, items: [] }
      map[e.category].total += e.amount || 0
      map[e.category].items.push(e)
    }
    return map
  }, [expensesCurrent])

  /* ========= UI ========= */
  if (status === "loading") return <div className="p-6">Carregando sessão…</div>
  if (status === "unauthenticated") return <div className="p-6">Faça login para acessar.</div>

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Gastos em Família</h1>
            {selectedProject && (
              <span className={`px-2 py-0.5 text-xs rounded ${isClosed ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {isClosed ? "Projeto fechado" : "Projeto aberto"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">Salvando: {saveState.status === "saving" ? "…" : saveState.status === "ok" ? `ok às ${fmtHora(saveState.at)}` : saveState.status === "error" ? "erro" : "pronto"}</div>
            <button className="text-sm text-slate-600 hover:underline" onClick={()=>signOut()}>Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Seleção/Criação de família */}
        <section className="mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Código da família (slug)</label>
              <input value={slug} onChange={(e)=>setSlug(e.target.value)} className="px-3 py-2 rounded border bg-white" placeholder="ex.: familia-lucas" />
            </div>
            <button onClick={handleSetSlug} className="px-3 py-2 rounded bg-slate-900 text-white">Usar</button>

            {loading && <span className="text-sm text-slate-500">Carregando…</span>}
            {!!loadError && <span className="text-sm text-red-600">Erro: {loadError}</span>}
          </div>
        </section>

        {/* Se não há slug/doc, para aqui */}
        {!slug ? (
          <p className="text-slate-600">Defina o código da família para começar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Coluna esquerda: projeto, pessoas, categorias */}
            <div className="md:col-span-1 space-y-6">
              <div className="p-4 rounded-2xl bg-white border">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Projeto</h2>
                </div>

                {projects.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        className="w-full px-3 py-2 rounded border bg-white"
                        value={selectedProjectId}
                        onChange={(e)=>{
                          const id = e.target.value
                          setSelectedProjectId(id)
                          try { if (slug) localStorage.setItem(`project:${slug}`, id) } catch {}
                        }}
                      >
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.status === "closed" ? " (fechado)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={()=>setShowNewProject(v=>!v)} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Novo projeto</button>
                      <button
                        onClick={closeCurrentProject}
                        disabled={!selectedProject || isClosed}
                        className={`px-3 py-2 rounded-xl border ${(!selectedProject || isClosed) ? "text-gray-400 border-gray-200" : ""}`}
                        title={isClosed ? "Já está fechado" : "Fechar projeto atual"}
                      >
                        Fechar
                      </button>
                      <button
                        onClick={reopenCurrentProject}
                        disabled={!selectedProject || !isClosed}
                        className={`px-3 py-2 rounded-xl border ${(!selectedProject || !isClosed) ? "text-gray-400 border-gray-200" : ""}`}
                        title={!isClosed ? "Projeto já está aberto" : "Reabrir projeto"}
                      >
                        Reabrir
                      </button>
                      <button
                        onClick={deleteCurrentProject}
                        disabled={!selectedProject}
                        className={`px-3 py-2 rounded-xl border ${!selectedProject ? "text-gray-400 border-gray-200" : "text-red-700 border-red-200 hover:bg-red-50"}`}
                        title="Excluir projeto e todas as despesas dele"
                      >
                        Excluir
                      </button>
                    </div>

                    {showNewProject && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border">
                        <NewProjectForm onCreate={createProject} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <button onClick={()=>setShowNewProject(v=>!v)} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Criar primeiro projeto</button>
                    {showNewProject && <div className="mt-3 p-3 rounded-xl bg-slate-50 border"><NewProjectForm onCreate={createProject} /></div>}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-white border">
                <h2 className="font-semibold">Pessoas</h2>
                <TagEditor
                  items={people}
                  onAdd={addPerson}
                  onRemove={removePerson}
                  placeholder="Adicionar pessoa"
                />
              </div>

              <div className="p-4 rounded-2xl bg-white border">
                <h2 className="font-semibold">Categorias</h2>
                <TagEditor
                  items={categories}
                  onAdd={addCategory}
                  onRemove={removeCategory}
                  placeholder="Adicionar categoria"
                />
              </div>
            </div>

            {/* Coluna central: lançamentos e lista */}
            <div className="md:col-span-2 space-y-6">
              <div className="p-4 rounded-2xl bg-white border">
                <h2 className="font-semibold">Nova despesa</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <select className="px-3 py-2 rounded border bg-white" value={who} onChange={(e)=>setWho(e.target.value)}>
                    <option value="">Quem pagou?</option>
                    {people.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select className="px-3 py-2 rounded border bg-white" value={category} onChange={(e)=>setCategory(e.target.value)}>
                    <option value="">Categoria</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="px-3 py-2 rounded border bg-white" value={amount} onChange={(e)=>setAmount(e.target.value)} inputMode="decimal" placeholder="Valor (ex: 123,45)" />
                  <input className="px-3 py-2 rounded border bg-white" value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Descrição" />
                  <input className="px-3 py-2 rounded border bg-white" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
                <div className="mt-3">
                  <button onClick={addExpense} className="px-3 py-2 rounded-xl bg-emerald-600 text-white">Adicionar</button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Despesas por categoria</h2>
                  <div className="text-sm text-slate-500">Total: {currency(Object.values(totalsByCategory).reduce((a,b)=>a+b,0))}</div>
                </div>

                {/* LISTA AGRUPADA — agora com LINHA FINA entre cada CATEGORIA */}
                <div className="mt-3">
                  {Object.entries(groupedByCategory).length === 0 ? (
                    <div className="text-sm text-slate-500">Sem lançamentos.</div>
                  ) : (
                    Object.entries(groupedByCategory)
                      .sort((a,b)=> b[1].total - a[1].total)
                      .map(([cat, group], idx) => (
                        <div key={cat} className={idx > 0 ? "pt-4 mt-4 border-t border-slate-200" : ""}>
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{cat}</h3>
                            <div className="font-semibold">{currency(group.total)}</div>
                          </div>
                          <ul className="divide-y mt-2">
                            {group.items
                              .sort((a,b)=> (a.date > b.date ? -1 : 1))
                              .map(e => (
                                <li key={e.id} className="py-2 flex items-center justify-between">
                                  <div className="min-w-0">
                                    <div className="text-sm">
                                      <span className="font-medium">{e.who}</span> — {e.desc || "(sem descrição)"}
                                    </div>
                                    <div className="text-xs text-slate-500">{e.date}</div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="font-medium">{currency(e.amount)}</div>
                                    <button onClick={()=>removeExpense(e.id)} className="text-xs px-2 py-1 rounded border hover:bg-red-50 text-red-700 border-red-200">Excluir</button>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ===================== Componentes auxiliares ===================== */
function TagEditor({ items, onAdd, onRemove, placeholder }) {
  const [val, setVal] = useState("")
  return (
    <div>
      <div className="flex items-center gap-2 mt-2">
        <input
          className="px-3 py-2 rounded border bg-white w-full"
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

function NewProjectForm({ onCreate }) {
  const [type, setType] = useState("monthly")
  const [name, setName] = useState(monthKey(todayYYYYMMDD()))
  const [start, setStart] = useState(`${monthKey(todayYYYYMMDD())}-01`)
  const [end, setEnd] = useState("")

  useEffect(() => {
    if (type === "monthly") {
      const yyyyMM = monthKey(todayYYYYMMDD())
      setName(yyyyMM)
      setStart(`${yyyyMM}-01`)
      setEnd("")
    }
  }, [type])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select className="px-3 py-2 rounded border bg-white" value={type} onChange={(e)=>setType(e.target.value)}>
          <option value="monthly">Mensal</option>
          <option value="trip">Viagem</option>
          <option value="custom">Personalizado</option>
        </select>
        <input className="px-3 py-2 rounded border bg-white sm:col-span-3" placeholder="Nome do projeto" value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="px-3 py-2 rounded border bg-white" type="date" value={start} onChange={(e)=>setStart(e.target.value)} />
        <input className="px-3 py-2 rounded border bg-white" type="date" value={end} onChange={(e)=>setEnd(e.target.value)} placeholder="Término (opcional)" />
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-2 rounded-xl bg-blue-600 text-white"
          onClick={()=>onCreate(type, name || "(sem nome)", start || todayYYYYMMDD(), end || null)}
        >
          Criar
        </button>
      </div>
    </div>
  )
}
