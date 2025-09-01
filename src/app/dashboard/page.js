import React, { useEffect, useMemo, useState } from "react"

/*
 * PREVIEW AO VIVO NO CANVAS (corrigido)
 * - Simula projetos (fechar/DELETAR) e lista agrupada por categoria com separadores.
 * - Não usa NextAuth nem API — é só visual.
 * - Abaixo tem um botão para COPIAR o arquivo completo de src/app/dashboard/page.js (corrigido).
 */

function currency(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
const monthLabel = (yyyyMM)=> (/^\d{4}-\d{2}$/.test(yyyyMM)?`${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}`:yyyyMM)

// Pequeno "teste" rápido do monthLabel
useEffectTest()
function useEffectTest(){
  if (typeof window !== "undefined") {
    try { console.assert(monthLabel("2025-09") === "09/2025", "monthLabel falhou")} catch(e){}
  }
}

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
// ARQUIVO REAL: src/app/dashboard/page.js (corrigido)
// ==========================================
const pageJsFile = "// src/app/dashboard/page.js\n"
+ "\"use client\"\n"
+ "import React, { useCallback, useEffect, useMemo, useRef, useState } from \"react\"\n"
+ "import { useSession, signOut } from \"next-auth/react\"\n"
+ "import { useRouter } from \"next/navigation\"\n"
+ "import { carregarFamilia, salvarFamilia } from \"../actions\"\n\n"
+ "/* ===================== Helpers ===================== */\n"
+ "const currency = (v) => v.toLocaleString(\"pt-BR\", { style: \"currency\", currency: \"BRL\" })\n"
+ "const fmtHora = (iso) => { try { return new Date(iso).toLocaleTimeString(\"pt-BR\",{hour:\"2-digit\",minute:\"2-digit\"}) } catch { return \"\" } }\n"
+ "const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : \"\")\n"
+ "const monthLabel = (yyyyMM) => (/^\\d{4}-\\d{2}$/.test(yyyyMM) ? (yyyyMM.slice(5,7) + \"/\" + yyyyMM.slice(0,4)) : (yyyyMM || \"\"))\n"
+ "const todayYYYYMM = () => new Date().toISOString().slice(0,7)\n"
+ "const firstDayOfMonth = (yyyyMM) => (yyyyMM + \"-01\")\n\n"
+ "export default function Page() {\n"
+ "  const { status, data: session } = useSession()\n"
+ "  const router = useRouter()\n"
+ "  useEffect(() => { if (status === \"unauthenticated\") router.replace(\"/\") }, [status, router])\n"
+ "  if (status !== \"authenticated\") return <main style={{display:\"grid\",placeItems:\"center\",height:\"100vh\"}}>Carregando…</main>\n"
+ "  return <GastosApp user={session.user} onSignOut={() => signOut()} />\n"
+ "}\n\n"
+ "function makeDefaultProject(){\n"
+ "  return { id: ('proj-' + crypto.randomUUID()), name: \"Geral\", type: \"general\", start: new Date().toISOString().slice(0,10), end: null, status: \"open\" }\n"
+ "}\n\n"
+ "/* ===================== App ===================== */\n"
+ "function GastosApp({ user, onSignOut }) {\n"
+ "  const [slugInput, setSlugInput] = useState(\"\")\n"
+ "  const [slug, setSlug] = useState(\"\")\n"
+ "  const [loading, setLoading] = useState(true)\n"
+ "  const [saving, setSaving] = useState(false)\n"
+ "  const [error, setError] = useState(\"\")\n"
+ "  const [lastSavedAt, setLastSavedAt] = useState(null)\n\n"
+ "  const [people, setPeople] = useState([])\n"
+ "  const [categories, setCategories] = useState([\"Mercado\", \"Carro\", \"Aluguel\", \"Lazer\"])\n"
+ "  const [projects, setProjects] = useState([])\n"
+ "  const [expenses, setExpenses] = useState([])\n\n"
+ "  const [selectedProjectId, setSelectedProjectId] = useState(\"\")\n"
+ "  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])\n\n"
+ "  const readOnly = false\n\n"
+ "  const [showNewProject, setShowNewProject] = useState(false)\n"
+ "  const [newProjectType, setNewProjectType] = useState(\"monthly\")\n"
+ "  const [newProjectName, setNewProjectName] = useState(\"\")\n"
+ "  const [newProjectStart, setNewProjectStart] = useState(firstDayOfMonth(todayYYYYMM()))\n"
+ "  const [newProjectEnd, setNewProjectEnd] = useState(\"\")\n\n"
+ "  const [newPerson, setNewPerson] = useState(\"\")\n"
+ "  const [newCategory, setNewCategory] = useState(\"\")\n"
+ "  const [who, setWho] = useState(\"\")\n"
+ "  const [category, setCategory] = useState(\"\")\n"
+ "  const [amount, setAmount] = useState(\"\")\n"
+ "  const [desc, setDesc] = useState(\"\")\n"
+ "  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))\n"
+ "  const [filterCat, setFilterCat] = useState(\"Todos\")\n"
+ "  const [selectedMonth, setSelectedMonth] = useState(todayYYYYMM())\n\n"
+ "  useEffect(() => {\n"
+ "    const storedSlug = (typeof window !== \"undefined\") ? localStorage.getItem(\"familySlug\") : \"\"\n"
+ "    const initialSlug = storedSlug || \"\"\n"
+ "    setSlug(initialSlug)\n"
+ "    setSlugInput(initialSlug)\n\n"
+ "    async function boot(s){\n"
+ "      setLoading(true); setError(\"\")\n"
+ "      try {\n"
+ "        const doc = await carregarFamilia(s)\n"
+ "        setPeople(doc.people || [])\n"
+ "        setCategories(doc.categories || [\"Mercado\",\"Carro\",\"Aluguel\",\"Lazer\"])\n"
+ "        setProjects(doc.projects || [])\n"
+ "        setExpenses(doc.expenses || [])\n"
+ "        if (doc.updatedAt) setLastSavedAt(doc.updatedAt)\n\n"
+ "        const storageKey = (\"project:\" + s)\n"
+ "        const storedPid = localStorage.getItem(storageKey)\n"
+ "        const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid)) ? storedPid : ((doc.projects.find(p => p.status === \"open\") && doc.projects.find(p => p.status === \"open\").id) || (doc.projects[0] && doc.projects[0].id) || \"\")\n"
+ "        setSelectedProjectId(pid)\n"
+ "        if (pid) localStorage.setItem(storageKey, pid)\n\n"
+ "        setSelectedMonth(todayYYYYMM())\n"
+ "      } catch(e) { setError(String(e.message || e)) } finally { setLoading(false) }\n"
+ "    }\n"
+ "    if (initialSlug) boot(initialSlug); else setLoading(false)\n"
+ "  }, [])\n\n"
+ "  const aplicarSlug = useCallback(async () => {\n"
+ "    const s = slugInput.trim().toLowerCase(); if (!s) return\n"
+ "    setSlug(s); localStorage.setItem(\"familySlug\", s)\n"
+ "    setLoading(true); setError(\"\")\n"
+ "    try {\n"
+ "      const doc = await carregarFamilia(s)\n"
+ "      setPeople(doc.people || [])\n"
+ "      setCategories(doc.categories || [\"Mercado\",\"Carro\",\"Aluguel\",\"Lazer\"])\n"
+ "      setProjects(doc.projects || [])\n"
+ "      setExpenses(doc.expenses || [])\n"
+ "      setLastSavedAt(doc.updatedAt || null)\n\n"
+ "      const storageKey = (\"project:\" + s)\n"
+ "      const storedPid = localStorage.getItem(storageKey)\n"
+ "      const pid = (storedPid && (doc.projects||[]).some(p => p.id === storedPid)) ? storedPid : ((doc.projects.find(p => p.status === \"open\") && doc.projects.find(p => p.status === \"open\").id) || (doc.projects[0] && doc.projects[0].id) || \"\")\n"
+ "      setSelectedProjectId(pid)\n"
+ "      if (pid) localStorage.setItem(storageKey, pid)\n\n"
+ "      setSelectedMonth(todayYYYYMM())\n"
+ "    } catch(e) { setError(String(e.message || e)) } finally { setLoading(false) }\n"
+ "  }, [slugInput])\n\n"
+ "  const saveTimer = useRef(null)\n"
+ "  const queueSave = useCallback((next) => {\n"
+ "    if (!slug) return\n"
+ "    if (saveTimer.current) clearTimeout(saveTimer.current)\n"
+ "    saveTimer.current = setTimeout(async () => {\n"
+ "      setSaving(true); setError(\"\")\n"
+ "      try {\n"
+ "        const res = await salvarFamilia(slug, { people: next.people, categories: next.categories, projects: next.projects, expenses: next.expenses })\n"
+ "        setLastSavedAt((res && res.updatedAt) ? res.updatedAt : new Date().toISOString())\n"
+ "      } catch(e) { setError(String(e.message || e)) } finally { setSaving(false) }\n"
+ "    }, 800)\n"
+ "  }, [slug])\n\n"
+ "  const retrySave = useCallback(async () => {\n"
+ "    if (!slug) return\n"
+ "    setSaving(true); setError(\"\")\n"
+ "    try {\n"
+ "      const res = await salvarFamilia(slug, { people, categories, projects, expenses })\n"
+ "      setLastSavedAt((res && res.updatedAt) ? res.updatedAt : new Date().toISOString())\n"
+ "    } catch(e) { setError(String(e.message || e)) } finally { setSaving(false) }\n"
+ "  }, [slug, people, categories, projects, expenses])\n\n"
+ "  const setDocAndSave = useCallback((updater) => {\n"
+ "    const next = { people, categories, projects, expenses }\n"
+ "    updater(next)\n"
+ "    setPeople(next.people); setCategories(next.categories); setProjects(next.projects); setExpenses(next.expenses)\n"
+ "    queueSave(next)\n"
+ "  }, [people, categories, projects, expenses, queueSave])\n\n"
+ "  const changeProject = useCallback((pid) => {\n"
+ "    setSelectedProjectId(pid)\n"
+ "    if (slug) localStorage.setItem((\"project:\" + slug), pid)\n"
+ "  }, [slug])\n\n"
+ "  function createProject(){\n"
+ "    var name = (newProjectName||\"\").trim()\n"
+ "    var type = newProjectType\n"
+ "    var start = newProjectStart || new Date().toISOString().slice(0,10)\n"
+ "    var end = newProjectEnd || null\n\n"
+ "    if (type === \"monthly\") {\n"
+ "      name = name || todayYYYYMM()\n"
+ "      start = firstDayOfMonth(/^\\d{4}-\\d{2}$/.test(name) ? name : todayYYYYMM())\n"
+ "      end = null\n"
+ "    }\n"
+ "    if (!name) name = (type === \"trip\") ? \"Viagem\" : ((type === \"custom\") ? \"Projeto\" : \"Mensal\")\n\n"
+ "    const proj = { id: ('proj-' + crypto.randomUUID()), name: name, type: type, start: start, end: end, status: \"open\" }\n"
+ "    setDocAndSave(function(d){ d.projects = [proj].concat(d.projects) })\n"
+ "    setSelectedProjectId(proj.id)\n"
+ "    if (slug) localStorage.setItem((\"project:\" + slug), proj.id)\n\n"
+ "    setShowNewProject(false); setNewProjectName(\"\"); setNewProjectStart(firstDayOfMonth(todayYYYYMM())); setNewProjectEnd(\"\"); setNewProjectType(\"monthly\")\n"
+ "  }\n\n"
+ "  function closeCurrentProject(){\n"
+ "    if (!selectedProject) return\n"
+ "    var ok = confirm(\"Marcar o projeto \" + selectedProject.name + \" como fechado? (edição continua permitida)\") ; if (!ok) return\n"
+ "    setDocAndSave(function(d){ d.projects = d.projects.map(function(p){ return p.id===selectedProject.id ? { ...p, status: \"closed\", end: (p.end || new Date().toISOString().slice(0,10)) } : p }) })\n"
+ "  }\n\n"
+ "  function deleteCurrentProject(){\n"
+ "    if (!selectedProject) return\n"
+ "    var ok = confirm(\"Apagar o projeto \" + selectedProject.name + \" e TODAS as despesas dele?\") ; if (!ok) return\n"
+ "    setDocAndSave(function(d){\n"
+ "      var delId = selectedProject.id\n"
+ "      var nextProjects = d.projects.filter(function(p){ return p.id !== delId })\n"
+ "      var nextExpenses = d.expenses.filter(function(e){ return e.projectId !== delId })\n"
+ "      if (nextProjects.length === 0) {\n"
+ "        var def = makeDefaultProject()\n"
+ "        nextProjects = [def]\n"
+ "      }\n"
+ "      d.projects = nextProjects\n"
+ "      d.expenses = nextExpenses\n"
+ "      var newSelected = nextProjects[0].id\n"
+ "      setSelectedProjectId(newSelected)\n"
+ "      if (slug) localStorage.setItem((\"project:\" + slug), newSelected)\n"
+ "    })\n"
+ "  }\n\n"
+ "  function addPerson(){ var name = newPerson.trim(); if (!name || people.includes(name)) return; setDocAndSave(function(d){ d.people=d.people.concat([name]) }); setNewPerson(\"\"); if (!who) setWho(name) }\n"
+ "  function removePerson(name){ if (!people.includes(name)) return; setDocAndSave(function(d){ d.people=d.people.filter(function(p){return p!==name}); d.expenses=d.expenses.filter(function(e){return e.who!==name}) }); if (who===name) setWho(\"\") }\n"
+ "  function addCategory(){ var cat=newCategory.trim(); if(!cat||categories.includes(cat))return; setDocAndSave(function(d){ d.categories=d.categories.concat([cat]) }); setNewCategory(\"\"); if(!category) setCategory(cat) }\n"
+ "  function removeCategory(cat){ if(!categories.includes(cat))return; var ok=confirm(\"Remover a categoria \" + cat + \"? Todas as despesas dessa categoria (em todos os projetos) serão apagadas.\"); if(!ok)return; setDocAndSave(function(d){ d.categories=d.categories.filter(function(c){return c!==cat}); d.expenses=d.expenses.filter(function(e){return e.category!==cat}) }); if(filterCat===cat)setFilterCat(\"Todos\"); if(category===cat)setCategory(\"\") }\n"
+ "  function addExpense(){ if(!selectedProject)return; var amt=Number(String(amount).replace(\",\",\".\")); if(!who||!category||!amt||isNaN(amt))return; var e={ id: crypto.randomUUID(), who: who, category: category, amount: amt, desc: desc.trim(), date: date, projectId: selectedProject.id }; setDocAndSave(function(d){ d.expenses=[e].concat(d.expenses) }); setAmount(\"\"); setDesc(\"\"); var mk = monthKey(date); if(mk) setSelectedMonth(mk) }\n"
+ "  function removeExpense(id){ setDocAndSave(function(d){ d.expenses=d.expenses.filter(function(e){return e.id!==id}) }) }\n"
+ "  function resetAll(){ if(!confirm(\"Apagar TODOS os dados desta família (todos os projetos)?\")) return; var cleared={ people:[], categories:[\"Mercado\",\"Carro\",\"Aluguel\",\"Lazer\"], projects: projects, expenses:[] }; setPeople(cleared.people); setCategories(cleared.categories); setExpenses(cleared.expenses); queueSave({ people: cleared.people, categories: cleared.categories, projects: projects, expenses: cleared.expenses }); setWho(\"\"); setCategory(\"\"); setAmount(\"\"); setDesc(\"\") }\n\n"
+ "  const projectExpenses = useMemo(function(){ return expenses.filter(function(e){ return e.projectId===selectedProjectId }) }, [expenses, selectedProjectId])\n"
+ "  const months = useMemo(function(){ var s=new Set(projectExpenses.map(function(e){return monthKey(e.date)}).filter(Boolean)); if(!s.size) s.add(todayYYYYMM()); return Array.from(s).sort().reverse() }, [projectExpenses])\n"
+ "  const monthlyExpenses = useMemo(function(){ return projectExpenses.filter(function(e){ return monthKey(e.date)===selectedMonth }) }, [projectExpenses, selectedMonth])\n"
+ "  const filteredExpenses = useMemo(function(){ return monthlyExpenses.filter(function(e){ return (filterCat===\"Todos\") || (e.category===filterCat) }) }, [monthlyExpenses, filterCat])\n"
+ "  const total = useMemo(function(){ return monthlyExpenses.reduce(function(s,e){return s+e.amount},0) }, [monthlyExpenses])\n"
+ "  const perHead = useMemo(function(){ return (people.length>0 ? total/people.length : 0) }, [people.length,total])\n"
+ "  const paidBy = useMemo(function(){ var map={}; people.forEach(function(p){map[p]=0}); monthlyExpenses.forEach(function(e){ map[e.who]=(map[e.who]||0)+e.amount }); return map }, [monthlyExpenses, people])\n"
+ "  const balances = useMemo(function(){ return people.map(function(p){ return { person:p, balance:(paidBy[p]||0)-perHead } }) }, [people, paidBy, perHead])\n"
+ "  const settlements = useMemo(function(){ var debtors=balances.filter(function(b){return b.balance<-0.01}).map(function(b){return {person:b.person,value:-b.balance}}); var creditors=balances.filter(function(b){return b.balance>0.01}).map(function(b){return {person:b.person,value:b.balance}}); var moves=[]; var i=0,j=0; while(i<debtors.length&&j<creditors.length){ var pay=Math.min(debtors[i].value,creditors[j].value); moves.push({from:debtors[i].person,to:creditors[j].person,value:pay}); debtors[i].value-=pay; creditors[j].value-=pay; if(debtors[i].value<=0.01)i++; if(creditors[j].value<=0.01)j++ } return moves }, [balances])\n"
+ "  const groupedByCategory = useMemo(function(){ var map={}; filteredExpenses.forEach(function(e){ if(!map[e.category]) map[e.category]={ total:0, items:[] }; map[e.category].total+=e.amount; map[e.category].items.push(e) }); return map }, [filteredExpenses])\n"
+ "  const totalsByCategory = useMemo(function(){ var m={}; monthlyExpenses.forEach(function(e){ m[e.category]=(m[e.category]||0)+e.amount }); return m }, [monthlyExpenses])\n\n"
+ "  if (!slug) {\n"
+ "    return (\n"
+ "      <main className=\"min-h-screen grid place-items-center bg-slate-50 p-6\">\n"
+ "        <div className=\"max-w-md w-full bg-white rounded-2xl shadow p-5 space-y-4\">\n"
+ "          <h1 className=\"text-xl font-bold\">Conectar à família</h1>\n"
+ "          <p className=\"text-sm text-slate-600\">Digite um código (ex.: <b>familia-ribeiro</b>). Quem usar o mesmo código verá os mesmos dados.</p>\n"
+ "          <input value={slugInput} onChange={(e)=>setSlugInput(e.target.value)} placeholder=\"ex.: familia-ribeiro\" className=\"w-full px-3 py-2 rounded-xl border\" />\n"
+ "          <button onClick={aplicarSlug} className=\"w-full px-4 py-2 rounded-xl bg-blue-600 text-white\">Usar este código</button>\n"
+ "          {error && <p className=\"text-sm text-red-600\">{error}</p>}\n"
+ "        </div>\n"
+ "      </main>\n"
+ "    )\n"
+ "  }\n\n"
+ "  if (loading) return <main className=\"min-h-screen grid place-items-center\">Carregando dados…</main>\n\n"
+ "  return (\n"
+ "    <div className=\"min-h-screen bg-slate-50 text-slate-800 p-6\">\n"
+ "      <div className=\"max-w-6xl mx-auto space-y-6\">\n"
+ "        <header className=\"flex items-center justify-between\">\n"
+ "          <div>\n"
+ "            <h1 className=\"text-2xl md:text-3xl font-bold\">Gastos em Família</h1>\n"
+ "            <div className=\"text-xs text-slate-500 flex items-center gap-2\">\n"
+ "              <span>Família: <b>{slug}</b></span>\n"
+ "              {saving && <span className=\"text-emerald-600\">salvando…</span>}\n"
+ "              {!saving && lastSavedAt && <span>Último salvo às {fmtHora(lastSavedAt)}</span>}\n"
+ "              {error && <span className=\"text-red-600\">erro: {error}</span>}\n"
+ "            </div>\n"
+ "          </div>\n"
+ "          <div className=\"flex items-center gap-2\">\n"
+ "            <span className=\"text-sm text-slate-600 hidden sm:block\">{user?.name}</span>\n"
+ "            <input value={slugInput} onChange={(e)=>setSlugInput(e.target.value)} placeholder=\"trocar família…\" className=\"px-3 py-2 rounded-xl border hidden md:block\" style={{minWidth:220}} />\n"
+ "            <button onClick={aplicarSlug} className=\"px-3 py-2 rounded-2xl border text-sm hidden md:inline-flex\">Trocar família</button>\n"
+ "            {error && <button onClick={retrySave} className=\"px-3 py-2 rounded-2xl bg-yellow-100 text-yellow-800 text-sm\">Tentar novamente</button>}\n"
+ "            <button onClick={resetAll} className=\"px-3 py-2 rounded-2xl text-sm bg-red-100 text-red-700 hover:bg-red-200\">Limpar tudo</button>\n"
+ "            <button onClick={onSignOut} className=\"px-3 py-2 rounded-2xl border text-sm\">Sair</button>\n"
+ "          </div>\n"
+ "        </header>\n\n"
+ "        <section className=\"bg-white rounded-2xl shadow p-4\">\n"
+ "          <div className=\"flex flex-col md:flex-row md:items-end md:justify-between gap-3\">\n"
+ "            <div className=\"flex items-center gap-2 flex-wrap\">\n"
+ "              <div className=\"space-y-1\">\n"
+ "                <label className=\"block text-xs\">Projeto atual</label>\n"
+ "                <select value={selectedProjectId} onChange={(e)=>changeProject(e.target.value)} className=\"px-3 py-2 rounded-xl border min-w-[220px]\">\n"
+ "                  {projects.map(function(p){ return (<option key={p.id} value={p.id}>{p.name} {p.status===\"closed\"?\"(fechado)\":\"\"}</option>) })}\n"
+ "                </select>\n"
+ "              </div>\n"
+ "            </div>\n\n"
+ "            <div className=\"flex items-center gap-2\">\n"
+ "              <button onClick={function(){setShowNewProject(function(v){return !v})}} className=\"px-3 py-2 rounded-xl bg-blue-600 text-white\">Novo projeto</button>\n"
+ "              <button onClick={closeCurrentProject} disabled={!selectedProject} className={\"px-3 py-2 rounded-xl border \" + (!selectedProject ? \"text-gray-400 border-gray-200\" : \"\")} >Fechar projeto</button>\n"
+ "              <button onClick={deleteCurrentProject} disabled={!selectedProject} className={\"px-3 py-2 rounded-xl bg-red-600 text-white \" + (!selectedProject?\"opacity-60\":\"\")} >Apagar projeto</button>\n"
+ "            </div>\n"
+ "          </div>\n\n"
+ "          {selectedProject && selectedProject.status === \"closed\" && (\n"
+ "            <div className=\"mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2\">\n"
+ "              Projeto marcado como <b>fechado</b>. A edição continua permitida (rótulo informativo).\n"
+ "            </div>\n"
+ "          )}\n\n"
+ "          {showNewProject && (\n"
+ "            <div className=\"mt-4 p-4 rounded-xl border grid md:grid-cols-5 gap-3\">\n"
+ "              <div className=\"md:col-span-1\">\n"
+ "                <label className=\"block text-xs mb-1\">Tipo</label>\n"
+ "                <select value={newProjectType} onChange={function(e){setNewProjectType(e.target.value)}} className=\"w-full px-3 py-2 rounded-xl border\">\n"
+ "                  <option value=\"monthly\">Mensal</option>\n"
+ "                  <option value=\"trip\">Viagem</option>\n"
+ "                  <option value=\"custom\">Personalizado</option>\n"
+ "                </select>\n"
+ "              </div>\n"
+ "              <div className=\"md:col-span-2\">\n"
+ "                <label className=\"block text-xs mb-1\">Nome</label>\n"
+ "                <input value={newProjectName} onChange={function(e){setNewProjectName(e.target.value)}} placeholder={(newProjectType===\"monthly\")?\"AAAA-MM (ex.: 2025-09)\":\"ex.: Viagem Nordeste\"} className=\"w-full px-3 py-2 rounded-xl border\" />\n"
+ "              </div>\n"
+ "              <div className=\"md:col-span-1\">\n"
+ "                <label className=\"block text-xs mb-1\">Início</label>\n"
+ "                <input type=\"date\" value={newProjectStart} onChange={function(e){setNewProjectStart(e.target.value)}} className=\"w-full px-3 py-2 rounded-xl border\" />\n"
+ "              </div>\n"
+ "              <div className=\"md:col-span-1\">\n"
+ "                <label className=\"block text-xs mb-1\">Fim (opcional)</label>\n"
+ "                <input type=\"date\" value={newProjectEnd} onChange={function(e){setNewProjectEnd(e.target.value)}} className=\"w-full px-3 py-2 rounded-xl border\" />\n"
+ "              </div>\n"
+ "              <div className=\"md:col-span-5 flex justify-end gap-2\">\n"
+ "                <button onClick={function(){setShowNewProject(false)}} className=\"px-3 py-2 rounded-xl border\">Cancelar</button>\n"
+ "                <button onClick={createProject} className=\"px-3 py-2 rounded-xl bg-blue-600 text-white\">Criar</button>\n"
+ "              </div>\n"
+ "            </div>\n"
+ "          )}\n"
+ "        </section>\n\n"
+ "        <section className=\"bg-white rounded-2xl shadow p-4\">\n"
+ "          <h2 className=\"font-semibold mb-3\">Período (mês) — {selectedProject ? selectedProject.name : \"—\"}</h2>\n"
+ "        </section>\n\n"
+ "        <section className=\"grid md:grid-cols-2 gap-4\">\n"
+ "          <div className=\"bg-white rounded-2xl shadow p-4\">\n"
+ "            <h2 className=\"font-semibold mb-3\">1) Pessoas do grupo</h2>\n"
+ "            <div className=\"flex gap-2 mb-3\">\n"
+ "              <input value={newPerson} onChange={function(e){setNewPerson(e.target.value)}} placeholder=\"Nome (ex.: Ana)\" className=\"flex-1 px-3 py-2 rounded-xl border\" />\n"
+ "              <button onClick={addPerson} className=\"px-4 py-2 rounded-xl bg-blue-600 text-white\">Adicionar</button>\n"
+ "            </div>\n"
+ "          </div>\n"
+ "          <div className=\"bg-white rounded-2xl shadow p-4\">\n"
+ "            <h2 className=\"font-semibold mb-3\">2) Categorias</h2>\n"
+ "            <div className=\"flex gap-2 mb-3\">\n"
+ "              <input value={newCategory} onChange={function(e){setNewCategory(e.target.value)}} placeholder=\"Nova categoria\" className=\"flex-1 px-3 py-2 rounded-xl border\" />\n"
+ "              <button onClick={addCategory} className=\"px-4 py-2 rounded-xl bg-emerald-600 text-white\">Adicionar</button>\n"
+ "            </div>\n"
+ "          </div>\n"
+ "        </section>\n\n"
+ "        <section className=\"grid lg:grid-cols-3 gap-4\">\n"
+ "          <div className=\"lg:col-span-2 bg-white rounded-2xl shadow p-4\">\n"
+ "            <h2 className=\"font-semibold mb-3\">Despesas {monthLabel(selectedMonth)} {selectedProject ? (\"— \" + selectedProject.name) : \"\"}</h2>\n"
+ "            {Object.keys(groupedByCategory).length === 0 ? (\n"
+ "              <p className=\"text-sm text-slate-500\">Sem despesas neste mês (ou no filtro aplicado).</p>\n"
+ "            ) : (\n"
+ "              <div className=\"space-y-6\">\n"
+ "                {Object.entries(groupedByCategory)\n"
+ "                  .sort(function(a,b){ return b[1].total - a[1].total })\n"
+ "                  .map(function(entry, idx){ var cat=entry[0], group=entry[1]; return (\n"
+ "                  <div key={cat} className={(idx>0?\"pt-4 border-t border-slate-200\":\"\")}>\n"
+ "                    <div className=\"flex items-center justify-between\">\n"
+ "                      <h3 className=\"font-semibold\">{cat}</h3>\n"
+ "                      <div className=\"font-semibold\">{currency(group.total)}</div>\n"
+ "                    </div>\n"
+ "                    <ul className=\"divide-y mt-2\">\n"
+ "                      {group.items.map(function(e){ return (\n"
+ "                        <li key={e.id} className=\"py-2 flex items-center justify-between gap-4\">\n"
+ "                          <div className=\"flex-1\">\n"
+ "                            <div className=\"font-medium\">{e.desc || e.category}</div>\n"
+ "                            <div className=\"text-xs text-slate-500\">{e.who} • {new Date(e.date).toLocaleDateString(\"pt-BR\")}</div>\n"
+ "                          </div>\n"
+ "                          <div className=\"w-28 text-right font-semibold\">{currency(e.amount)}</div>\n"
+ "                          <button onClick={function(){removeExpense(e.id)}} className=\"text-sm text-red-600 hover:underline\">remover</button>\n"
+ "                        </li>\n"
+ "                      )})}\n"
+ "                    </ul>\n"
+ "                  </div>\n"
+ "                )})}\n"
+ "              </div>\n"
+ "            )}\n"
+ "          </div>\n\n"
+ "          <div className=\"bg-white rounded-2xl shadow p-4 space-y-4\">\n"
+ "            <div>\n"
+ "              <h2 className=\"font-semibold mb-2\">Resumo de {monthLabel(selectedMonth)}</h2>\n"
+ "              <div className=\"text-sm flex justify-between\"><span>Total do mês</span><span className=\"font-semibold\">{currency(total)}</span></div>\n"
+ "              <div className=\"text-sm flex justify-between\"><span>Por pessoa ({people.length || 0})</span><span className=\"font-semibold\">{currency(perHead || 0)}</span></div>\n"
+ "            </div>\n"
+ "            <div>\n"
+ "              <h3 className=\"font-semibold mb-2\">Totais por categoria (mês)</h3>\n"
+ "              {Object.keys(totalsByCategory).length===0 ? (\n"
+ "                <p className=\"text-sm text-slate-500\">Sem lançamentos neste mês.</p>\n"
+ "              ) : (\n"
+ "                <ul className=\"text-sm space-y-1\">\n"
+ "                  {Object.entries(totalsByCategory).sort(function(a,b){ return b[1]-a[1] }).map(function(entry){ var cat=entry[0], val=entry[1]; return (\n"
+ "                    <li key={cat} className=\"flex justify-between\"><span>{cat}</span><span className=\"font-semibold\">{currency(val)}</span></li>\n"
+ "                  )})}\n"
+ "                </ul>\n"
+ "              )}\n"
+ "            </div>\n"
+ "            <div>\n"
+ "              <h3 className=\"font-semibold mb-2\">Acertos (mês)</h3>\n"
+ "              {settlements.length===0 ? <p className=\"text-sm text-slate-500\">Ninguém deve ninguém.</p> : (\n"
+ "                <ul className=\"space-y-1 text-sm\">\n"
+ "                  {settlements.map(function(m,idx){ return (\n"
+ "                    <li key={idx} className=\"flex justify-between\"><span><b>{m.from}</b> deve para <b>{m.to}</b></span><span className=\"font-semibold\">{currency(m.value)}</span></li>\n"
+ "                  )})}\n"
+ "                </ul>\n"
+ "              )}\n"
+ "            </div>\n"
+ "          </div>\n"
+ "        </section>\n\n"
+ "        <footer className=\"text-center text-xs text-slate-500 pt-6\">Dica: organize por <b>Projetos</b> (mês, viagem, etc.).</footer>\n"
+ "      </div>\n"
+ "    </div>\n"
+ "  )\n"
+ "}\n"
