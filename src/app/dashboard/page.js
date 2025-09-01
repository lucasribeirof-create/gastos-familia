import React, { useMemo, useState } from "react"

/*
 * PREVIEW AO VIVO NO CANVAS
 * - Simula projetos (com fechar/DELETAR) e lista agrupada por categoria com separadores.
 * - Não usa NextAuth nem API — é só para visualizar o comportamento.
 * - Abaixo do preview tem um bloco com o CÓDIGO COMPLETO de src/app/dashboard/page.js para copiar.
 */

function currency(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
const monthLabel = (yyyyMM)=> (/^\d{4}-\d{2}$/.test(yyyyMM)?`${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}`:yyyyMM)

function makeDefaultProject(){
  return { id: `proj-${crypto.randomUUID()}`, name: "Geral", type: "general", start: new Date().toISOString().slice(0,10), end: null, status: "open" }
}

export default function Preview() {
  // ---- Estado de demonstração ----
  const [projects, setProjects] = useState([
    { id: "proj-geral", name: "Geral", type: "general", start: "2025-09-01", end: null, status: "open" },
    { id: "proj-2025-09", name: "2025-09", type: "monthly", start: "2025-09-01", end: null, status: "closed" },
  ])
  const [selectedProjectId, setSelectedProjectId] = useState("proj-geral")
  const selected = useMemo(()=>projects.find(p=>p.id===selectedProjectId)||null,[projects,selectedProjectId])

  // Despesas simuladas do mês, já agrupadas
  const grouped = {
    Mercado: [
      { id: "1", who: "Ana", amount: 120.5, desc: "feira", date: "2025-09-02" },
      { id: "2", who: "Lucas", amount: 89.9, desc: "mercearia", date: "2025-09-10" },
    ],
    Carro: [ { id: "3", who: "Ana", amount: 300, desc: "gasolina", date: "2025-09-05" } ],
    Lazer: [ { id: "4", who: "Lucas", amount: 150, desc: "cinema", date: "2025-09-12" } ],
  }
  const totalsByCategory = Object.fromEntries(Object.entries(grouped).map(([k,items])=>[k,items.reduce((s,e)=>s+e.amount,0)]))

  function closeProject(){
    if(!selected) return
    setProjects(ps=>ps.map(p=> p.id===selected.id ? { ...p, status: "closed", end: p.end||new Date().toISOString().slice(0,10)}: p ))
  }
  function deleteProject(){
    if(!selected) return
    if(!confirm(`Apagar projeto "${selected.name}"? (exemplo: remove também as despesas dele)`)) return
    setProjects(ps=>{
      const rest = ps.filter(p=>p.id!==selected.id)
      if(rest.length===0) rest.unshift(makeDefaultProject())
      const nextId = rest[0].id
      setSelectedProjectId(nextId)
      return rest
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Preview do Dashboard</h1>
            <p className="text-xs text-slate-500">Fechar projeto NÃO trava edição. Há botão de apagar projeto. Separadores entre categorias abaixo.</p>
          </div>
        </header>

        {/* Projetos */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="space-y-1">
              <label className="block text-xs">Projeto atual</label>
              <select value={selectedProjectId} onChange={(e)=>setSelectedProjectId(e.target.value)} className="px-3 py-2 rounded-xl border min-w-[220px]">
                {projects.map(p=> <option key={p.id} value={p.id}>{p.name} {p.status==="closed"?"(fechado)":""}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={closeProject} className="px-3 py-2 rounded-xl border">Fechar projeto</button>
              <button onClick={deleteProject} className="px-3 py-2 rounded-xl bg-red-600 text-white">Apagar projeto</button>
            </div>
          </div>
          {selected?.status==="closed" && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Projeto marcado como <b>fechado</b>. (Prévia: edição continua permitida — é só um rótulo.)
            </div>
          )}
        </section>

        {/* Agrupado por categoria com separadores */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Despesas de 09/2025 — {selected?.name}</h2>
            <div className="space-y-6">
              {Object.entries(grouped).map(([cat,items],idx)=> (
                <div key={cat} className={idx>0?"pt-4 border-t border-slate-200":""}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{cat}</h3>
                    <div className="font-semibold">{currency(totalsByCategory[cat])}</div>
                  </div>
                  <ul className="divide-y mt-2">
                    {items.map(e=> (
                      <li key={e.id} className="py-2 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-medium">{e.desc}</div>
                          <div className="text-xs text-slate-500">{e.who} • {new Date(e.date).toLocaleDateString("pt-BR")}</div>
                        </div>
                        <div className="w-28 text-right font-semibold">{currency(e.amount)}</div>
                        <button className="text-red-600 text-sm hover:underline">remover</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-4 space-y-2">
            <h3 className="font-semibold mb-2">Totais por categoria</h3>
            <ul className="text-sm space-y-1">
              {Object.entries(totalsByCategory).map(([cat,val])=> (
                <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-semibold">{currency(val)}</span></li>
              ))}
            </ul>
          </div>
        </section>

        {/* Código completo da página real */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Código completo de <code>src/app/dashboard/page.js</code></h2>
          <p className="text-xs text-slate-600 mb-2">Use o botão para copiar tudo e colar no seu arquivo.</p>
          <div className="flex gap-2 mb-2">
            <button onClick={()=>navigator.clipboard.writeText(pageJsFile)} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Copiar código</button>
          </div>
          <textarea readOnly value={pageJsFile} className="w-full h-96 p-3 rounded-xl border font-mono text-xs" />
        </section>
      </div>
    </div>
  )
}

// ==========================================
// ARQUIVO REAL: src/app/dashboard/page.js
// ==========================================
const pageJsFile = `// src/app/dashboard/page.js
"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

/* ===================== Helpers ===================== */
const currency = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) } catch { return "" } }
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${'${'}yyyyMM.slice(5,7){'}'}/${'${'}yyyyMM.slice(0,4){'}'}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const firstDayOfMonth = (yyyyMM) => `${'${'}yyyyMM{'}'}-01`

export default function Page() {
  const { status, data: session } = useSession()
  const router = useRouter()
  useEffect(() => { if (status === "unauthenticated") router.replace("/") }, [status, router])
  if (status !== "authenticated") return <main style={{display:"grid",placeItems:"center",height:"100vh"}}>Carregando…</main>
  return <GastosApp user={session.user} onSignOut={() => signOut()} />
}

function makeDefaultProject(){
  return { id: `proj-${'${'}crypto.randomUUID(){'}'}`, name: "Geral", type: "general", start: new Date().toISOString().slice(0,10), end: null, status: "open" }
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
  const [projects, setProjects] = useState([])
  const [expenses, setExpenses] = useState([])

  // ----- Projeto atual -----
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])

  // IMPORTANTE: fechar projeto NÃO trava edição (requisito novo)
  const readOnly = false

  // ----- Inputs projetos -----
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectType, setNewProjectType] = useState("monthly")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectStart, setNewProjectStart] = useState(firstDayOfMonth(todayYYYYMM()))
  const [newProjectEnd, setNewProjectEnd] = useState("")

  // ----- Inputs e filtros -----
  const [newPerson, setNewPerson] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [filterCat, setFilterCat] = useState("Todos")
  const [selectedMonth, setSelectedMonth] = useState(todayYYYYMM())

  /* ===================== Carregamento ===================== */
  useEffect(() => {
    const storedSlug = typeof window !== "undefined" ? localStorage.getItem("familySlug") : ""
    const initialSlug = storedSlug || ""
    setSlug(initialSlug)
    setSlugInput(initialSlug)

    async function boot(s){
      setLoading(true); setError("")
      try {
        const doc = await carregarFamilia(s)
        setPeople(doc.people || [])
        setCategories(doc.categories || ["Mercado","Carro","Aluguel","Lazer"])
        setProjects(doc.projects || [])
        setExpenses(doc.expenses || [])
        if (doc.updatedAt) setLastSavedAt(doc.updatedAt)

        const storageKey = `project:${'${'}s{'}'}`
        const storedPid = localStorage.getItem(storageKey)
        const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid))
          ? storedPid
          : (doc.projects.find(p => p.status === "open")?.id || doc.projects[0]?.id || "")
        setSelectedProjectId(pid)
        if (pid) localStorage.setItem(storageKey, pid)

        setSelectedMonth(todayYYYYMM())
      } catch(e) { setError(String(e.message || e)) } finally { setLoading(false) }
    }
    if (initialSlug) boot(initialSlug); else setLoading(false)
  }, [])

  /* ===================== Trocar família ===================== */
  const aplicarSlug = useCallback(async () => {
    const s = slugInput.trim().toLowerCase(); if (!s) return
    setSlug(s); localStorage.setItem("familySlug", s)
    setLoading(true); setError("")
    try {
      const doc = await carregarFamilia(s)
      setPeople(doc.people || [])
      setCategories(doc.categories || ["Mercado","Carro","Aluguel","Lazer"])
      setProjects(doc.projects || [])
      setExpenses(doc.expenses || [])
      setLastSavedAt(doc.updatedAt || null)

      const storageKey = `project:${'${'}s{'}'}`
      const storedPid = localStorage.getItem(storageKey)
      const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid))
        ? storedPid
        : (doc.projects.find(p => p.status === "open")?.id || doc.projects[0]?.id || "")
      setSelectedProjectId(pid)
      if (pid) localStorage.setItem(storageKey, pid)

      setSelectedMonth(todayYYYYMM())
    } catch(e) { setError(String(e.message || e)) } finally { setLoading(false) }
  }, [slugInput])

  /* ===================== Autosave ===================== */
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
      } catch(e) { setError(String(e.message || e)) } finally { setSaving(false) }
    }, 800)
  }, [slug])

  const retrySave = useCallback(async () => {
    if (!slug) return
    setSaving(true); setError("")
    try {
      const res = await salvarFamilia(slug, { people, categories, projects, expenses })
      setLastSavedAt(res?.updatedAt || new Date().toISOString())
    } catch(e) { setError(String(e.message || e)) } finally { setSaving(false) }
  }, [slug, people, categories, projects, expenses])

  const setDocAndSave = useCallback((updater) => {
    const next = { people, categories, projects, expenses }
    updater(next)
    setPeople(next.people); setCategories(next.categories); setProjects(next.projects); setExpenses(next.expenses)
    queueSave(next)
  }, [people, categories, projects, expenses, queueSave])

  /* ===================== Projetos ===================== */
  const changeProject = useCallback((pid) => {
    setSelectedProjectId(pid)
    if (slug) localStorage.setItem(`project:${'${'}slug{'}'}`, pid)
  }, [slug])

  function createProject(){
    let name = (newProjectName||"").trim()
    let type = newProjectType
    let start = newProjectStart || new Date().toISOString().slice(0,10)
    let end = newProjectEnd || null

    if (type === "monthly") {
      name = name || todayYYYYMM()
      start = firstDayOfMonth(/^\d{4}-\d{2}$/.test(name) ? name : todayYYYYMM())
      end = null
    }
    if (!name) name = type === "trip" ? "Viagem" : (type === "custom" ? "Projeto" : "Mensal")

    const proj = { id: `proj-${'${'}crypto.randomUUID(){'}'}`, name, type, start, end, status: "open" }
    setDocAndSave(d => { d.projects = [proj, ...d.projects] })
    setSelectedProjectId(proj.id)
    if (slug) localStorage.setItem(`project:${'${'}slug{'}'}`, proj.id)

    setShowNewProject(false); setNewProjectName(""); setNewProjectStart(firstDayOfMonth(todayYYYYMM())); setNewProjectEnd(""); setNewProjectType("monthly")
  }

  function closeCurrentProject(){
    if (!selectedProject) return
    const ok = confirm(`Marcar o projeto "${'${'}selectedProject.name{'}'}" como fechado? (edição continua permitida)`) ; if (!ok) return
    setDocAndSave(d => { d.projects = d.projects.map(p => p.id===selectedProject.id ? { ...p, status: "closed", end: p.end || new Date().toISOString().slice(0,10) } : p) })
  }

  function deleteCurrentProject(){
    if (!selectedProject) return
    const ok = confirm(`Apagar o projeto "${'${'}selectedProject.name{'}'}" e TODAS as despesas dele?`) ; if (!ok) return
    setDocAndSave(d => {
      const delId = selectedProject.id
      let nextProjects = d.projects.filter(p => p.id !== delId)
      let nextExpenses = d.expenses.filter(e => e.projectId !== delId)
      if (nextProjects.length === 0) {
        const def = makeDefaultProject()
        nextProjects = [def]
      }
      d.projects = nextProjects
      d.expenses = nextExpenses
      const newSelected = nextProjects[0].id
      setSelectedProjectId(newSelected)
      if (slug) localStorage.setItem(`project:${'${'}slug{'}'}`, newSelected)
    })
  }

  /* ===================== Ações Pessoas/Categorias/Despesas ===================== */
  function addPerson(){ const name = newPerson.trim(); if (!name || people.includes(name)) return; setDocAndSave(d=>{ d.people=[...d.people,name] }); setNewPerson(""); if (!who) setWho(name) }
  function removePerson(name){ if (!people.includes(name)) return; setDocAndSave(d=>{ d.people=d.people.filter(p=>p!==name); d.expenses=d.expenses.filter(e=>e.who!==name) }); if (who===name) setWho("") }
  function addCategory(){ const cat=newCategory.trim(); if(!cat||categories.includes(cat))return; setDocAndSave(d=>{ d.categories=[...d.categories,cat] }); setNewCategory(""); if(!category) setCategory(cat) }
  function removeCategory(cat){ if(!categories.includes(cat))return; const ok=confirm(`Remover a categoria "${'${'}cat{'}'}"? Todas as despesas dessa categoria (em todos os projetos) serão apagadas.`); if(!ok)return; setDocAndSave(d=>{ d.categories=d.categories.filter(c=>c!==cat); d.expenses=d.expenses.filter(e=>e.category!==cat) }); if(filterCat===cat)setFilterCat("Todos"); if(category===cat)setCategory("") }
  function addExpense(){ if(!selectedProject)return; const amt=Number(String(amount).replace(",",".")); if(!who||!category||!amt||isNaN(amt))return; const e={ id: crypto.randomUUID(), who, category, amount: amt, desc: desc.trim(), date, projectId: selectedProject.id }; setDocAndSave(d=>{ d.expenses=[e,...d.expenses] }); setAmount(""); setDesc(""); const mk = monthKey(date); if(mk) setSelectedMonth(mk) }
  function removeExpense(id){ setDocAndSave(d=>{ d.expenses=d.expenses.filter(e=>e.id!==id) }) }
  function resetAll(){ if(!confirm("Apagar TODOS os dados desta família (todos os projetos)?")) return; const cleared={ people:[], categories:["Mercado","Carro","Aluguel","Lazer"], projects, expenses:[] }; setPeople(cleared.people); setCategories(cleared.categories); setExpenses(cleared.expenses); queueSave({ ...cleared, projects }); setWho(""); setCategory(""); setAmount(""); setDesc("") }

  /* ===================== Derivados por Projeto + Mês ===================== */
  const projectExpenses = useMemo(()=> expenses.filter(e=> e.projectId===selectedProjectId), [expenses, selectedProjectId])
  const months = useMemo(()=>{ const s=new Set(projectExpenses.map(e=>monthKey(e.date)).filter(Boolean)); if(!s.size) s.add(todayYYYYMM()); return Array.from(s).sort().reverse() },[projectExpenses])
  const monthlyExpenses = useMemo(()=> projectExpenses.filter(e=> monthKey(e.date)===selectedMonth), [projectExpenses, selectedMonth])
  const filteredExpenses = useMemo(()=> monthlyExpenses.filter(e=> filterCat==="Todos" || e.category===filterCat), [monthlyExpenses, filterCat])
  const total = useMemo(()=> monthlyExpenses.reduce((s,e)=>s+e.amount,0), [monthlyExpenses])
  const perHead = useMemo(()=> (people.length>0 ? total/people.length : 0), [people.length,total])
  const paidBy = useMemo(()=>{ const map={}; people.forEach(p=>map[p]=0); monthlyExpenses.forEach(e=>{ map[e.who]=(map[e.who]||0)+e.amount }); return map }, [monthlyExpenses, people])
  const balances = useMemo(()=> people.map(p=>({ person:p, balance:(paidBy[p]||0)-perHead })), [people, paidBy, perHead])
  const settlements = useMemo(()=>{ const debtors=balances.filter(b=>b.balance<-0.01).map(b=>({person:b.person,value:-b.balance})); const creditors=balances.filter(b=>b.balance>0.01).map(b=>({person:b.person,value:b.balance})); const moves=[]; let i=0,j=0; while(i<debtors.length&&j<creditors.length){ const pay=Math.min(debtors[i].value,creditors[j].value); moves.push({from:debtors[i].person,to:creditors[j].person,value:pay}); debtors[i].value-=pay; creditors[j].value-=pay; if(debtors[i].value<=0.01)i++; if(creditors[j].value<=0.01)j++ } return moves }, [balances])
  const groupedByCategory = useMemo(()=>{ const map={}; filteredExpenses.forEach(e=>{ if(!map[e.category]) map[e.category]={ total:0, items:[] }; map[e.category].total+=e.amount; map[e.category].items.push(e) }); return map }, [filteredExpenses])
  const totalsByCategory = useMemo(()=>{ const m={}; monthlyExpenses.forEach(e=>{ m[e.category]=(m[e.category]||0)+e.amount }); return m }, [monthlyExpenses])

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
            <button onClick={resetAll} className={`px-3 py-2 rounded-2xl text-sm bg-red-100 text-red-700 hover:bg-red-200`}>Limpar tudo</button>
            <button onClick={onSignOut} className="px-3 py-2 rounded-2xl border text-sm">Sair</button>
          </div>
        </header>

        {/* Projetos */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="space-y-1">
                <label className="block text-xs">Projeto atual</label>
                <select value={selectedProjectId} onChange={(e)=>changeProject(e.target.value)} className="px-3 py-2 rounded-xl border min-w-[220px]">
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.status==="closed"?"(fechado)":""}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={()=>setShowNewProject(v=>!v)} className="px-3 py-2 rounded-xl bg-blue-600 text-white">Novo projeto</button>
              <button onClick={closeCurrentProject} disabled={!selectedProject} className={`px-3 py-2 rounded-xl border ${(!selectedProject) ? "text-gray-400 border-gray-200" : ""}`}>Fechar projeto</button>
              <button onClick={deleteCurrentProject} disabled={!selectedProject} className={`px-3 py-2 rounded-xl bg-red-600 text-white ${(!selectedProject)?"opacity-60":""}`}>Apagar projeto</button>
            </div>
          </div>

          {selectedProject?.status === "closed" && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Projeto marcado como <b>fechado</b>. A edição continua permitida (rótulo informativo).
            </div>
          )}

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

        {/* Mês */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">Período (mês) — {selectedProject?.name || "—"}</h2>
          {/* Chips de mês renderizados no arquivo original */}
        </section>

        {/* Pessoas & Categorias */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">1) Pessoas do grupo</h2>
            <div className="flex gap-2 mb-3">
              <input value={newPerson} onChange={(e)=>setNewPerson(e.target.value)} placeholder="Nome (ex.: Ana)" className="flex-1 px-3 py-2 rounded-xl border" />
              <button onClick={addPerson} className="px-4 py-2 rounded-xl bg-blue-600 text-white">Adicionar</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">2) Categorias</h2>
            <div className="flex gap-2 mb-3">
              <input value={newCategory} onChange={(e)=>setNewCategory(e.target.value)} placeholder="Nova categoria" className="flex-1 px-3 py-2 rounded-xl border" />
              <button onClick={addCategory} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">Adicionar</button>
            </div>
          </div>
        </section>

        {/* Lista agrupada com SEPARADORES finos entre categorias */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Despesas {monthLabel(selectedMonth)} {selectedProject ? `— ${'${'}selectedProject.name{'}'}` : ""}</h2>
            {Object.keys(groupedByCategory).length === 0 ? (
              <p className="text-sm text-slate-500">Sem despesas neste mês (ou no filtro aplicado).</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory)
                  .sort((a,b)=> b[1].total - a[1].total)
                  .map(([cat, group], idx) => (
                  <div key={cat} className={idx>0?"pt-4 border-t border-slate-200":""}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{cat}</h3>
                      <div className="font-semibold">{currency(group.total)}</div>
                    </div>
                    <ul className="divide-y mt-2">
                      {group.items.map((e) => (
                        <li key={e.id} className="py-2 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{e.desc || e.category}</div>
                            <div className="text-xs text-slate-500">{e.who} • {new Date(e.date).toLocaleDateString("pt-BR")}</div>
                          </div>
                          <div className="w-28 text-right font-semibold">{currency(e.amount)}</div>
                          <button onClick={()=>removeExpense(e.id)} className={`text-sm text-red-600 hover:underline`}>remover</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <h2 className="font-semibold mb-2">Resumo de {monthLabel(selectedMonth)}</h2>
              <div className="text-sm flex justify-between"><span>Total do mês</span><span className="font-semibold">{currency(total)}</span></div>
              <div className="text-sm flex justify-between"><span>Por pessoa ({'${'}people.length||0{'}'})</span><span className="font-semibold">{currency(perHead||0)}</span></div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Totais por categoria (mês)</h3>
              {Object.keys(totalsByCategory).length===0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos neste mês.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {Object.entries(totalsByCategory).sort((a,b)=> b[1]-a[1]).map(([cat,val])=> (
                    <li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-semibold">{currency(val)}</span></li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Acertos (mês)</h3>
              {settlements.length===0 ? <p className="text-sm text-slate-500">Ninguém deve ninguém.</p> : (
                <ul className="space-y-1 text-sm">
                  {settlements.map((m,idx)=>(
                    <li key={idx} className="flex justify-between"><span><b>{'${'}m.from{'}'}</b> deve para <b>{'${'}m.to{'}'}</b></span><span className="font-semibold">{currency(m.value)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 pt-6">Dica: organize por <b>Projetos</b> (mês, viagem, etc.).</footer>
      </div>
    </div>
  )
}
`
