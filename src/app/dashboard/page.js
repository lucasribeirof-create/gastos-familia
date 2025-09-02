// src/app/dashboard/page.js
"use client"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { PieChart, Pie, Cell, Tooltip as RTooltip, Legend as RLegend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts"
import { roleOf } from "../../utils/authz"

// Helpers
const currency = (v) => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR") } catch { return "" } }
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0,7) : "")
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5,7)}/${yyyyMM.slice(0,4)}` : yyyyMM || "")
const todayYYYYMM = () => new Date().toISOString().slice(0,7)
const isoToday = () => new Date().toISOString().slice(0,10)
const hashId = (s)=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)} return "id_"+(h>>>0).toString(36) }
const colorForId = (id)=>{ let h=0; for(let i=0;i<id.length;i++){ h=(h*31+id.charCodeAt(i))%360 } return `hsl(${h} 70% 48%)` }
function stableCat(categories, name) {
  const found = categories.find(c => c.name === name)
  if (found) return found
  const id = hashId("cat:"+name)
  return { id, name, color: colorForId(id), order: categories.length, parentId: null }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [slug, setSlug] = useState(null)
  const [doc, setDoc] = useState(null)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [month, setMonth] = useState(todayYYYYMM())
  const [onlyCategoryId, setOnlyCategoryId] = useState(null)
  const [viewScope, setViewScope] = useState("month") // "month" | "project"
  const [showShare, setShowShare] = useState(false)
  const [theme, setTheme] = useState("dark")

  // form
  const [fDate, setFDate] = useState(isoToday())
  const [fWho, setFWho] = useState("")
  const [fCat, setFCat] = useState("")
  const [fDesc, setFDesc] = useState("")
  const [fVal, setFVal] = useState("")

  // slug do email
  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      const email = session.user.email.toLowerCase()
      const s = "fam-" + hashId(email).slice(3)
      setSlug(s)
    }
  }, [status, session])

  // tema
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark"
    setTheme(saved)
    document.documentElement.classList.toggle("dark", saved === "dark")
  }, [])
  const toggleTheme = ()=>{
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  const loadDoc = useCallback(async () => {
    if (!slug) return
    const res = await fetch(`/api/family/${slug}`, { cache: "no-store" })
    const j = await res.json()
    setDoc(j)
    if (!activeProjectId && j.projects?.length) setActiveProjectId(j.projects[0].id)
    if (j.people?.length && !fWho) setFWho(j.people[0])
    if (j.categories?.length && !fCat) setFCat(j.categories[0]?.id)
  }, [slug]) // eslint-disable-line
  useEffect(() => { loadDoc() }, [loadDoc])

  const myRole = useMemo(() => {
    if (!doc || !session?.user?.email) return "viewer"
    const p = doc.projects?.find(p => p.id === activeProjectId)
    return roleOf(session.user.email, p)
  }, [doc, session, activeProjectId])

  const categoriesById = useMemo(() => {
    const map = new Map()
    ;(doc?.categories || []).forEach(c => map.set(c.id, c))
    return map
  }, [doc])

  const expensesActive = useMemo(() => {
    if (!doc) return []
    const list = (doc.expenses || []).filter(e => e.projectId === activeProjectId)
    const filtered = list.filter(e => {
      const cat = categoriesById.get(e.category)
      if (onlyCategoryId && e.category !== onlyCategoryId && cat?.parentId !== onlyCategoryId) return false
      if (viewScope === "month") return monthKey(e.date) === month
      return true
    })
    return filtered.sort((a,b) => a.date.localeCompare(b.date))
  }, [doc, activeProjectId, month, onlyCategoryId, viewScope, categoriesById])

  const totals = useMemo(() => {
    let total = 0
    const byCat = {}
    const byWho = {}
    expensesActive.forEach(e => {
      const v = Number(e.amount)||0
      total += v
      byCat[e.category] = (byCat[e.category]||0)+v
      byWho[e.who] = (byWho[e.who]||0)+v
    })
    return { total, byCat, byWho }
  }, [expensesActive])

  const monthsSeries = useMemo(() => {
    if (!doc) return []
    const list = (doc.expenses || []).filter(e => e.projectId === activeProjectId)
    const map = new Map()
    list.forEach(e => {
      const mk = monthKey(e.date)
      map.set(mk, (map.get(mk)||0) + (Number(e.amount)||0))
    })
    const arr = Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>({ month:m, total:v }))
    for (let i=0;i<arr.length;i++){
      const w = arr.slice(Math.max(0,i-2), i+1).map(x=>x.total)
      const mm3 = w.length ? (w.reduce((a,b)=>a+b,0)/w.length) : arr[i].total
      const prev = i>0 ? arr[i-1].total : null
      const mom = (prev!=null && prev!==0) ? ((arr[i].total-prev)/prev)*100 : null
      arr[i].mm3 = mm3
      arr[i].mom = mom
    }
    return arr
  }, [doc, activeProjectId])

  const monthsByPerson = useMemo(() => {
    if (!doc) return []
    const list = (doc.expenses || []).filter(e => e.projectId === activeProjectId)
    const map = {}
    list.forEach(e => {
      const mk = monthKey(e.date)
      map[mk] ||= {}
      map[mk][e.who] = (map[mk][e.who]||0) + (Number(e.amount)||0)
    })
    const months = Object.keys(map).sort()
    const people = Array.from(new Set((doc.people||[])))
    return months.map(m => ({ month:m, ...people.reduce((acc,p)=>{ acc[p]=map[m][p]||0; return acc },{}) }))
  }, [doc, activeProjectId])

  const savePatch = useCallback(async (patch) => {
    if (!slug) return
    const res = await fetch(`/api/family/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeProjectId, ...patch })
    })
    const j = await res.json()
    if (!j.ok) {
      alert("Erro ao salvar: " + (j.error || "desconhecido"))
    } else {
      await loadDoc()
    }
  }, [slug, activeProjectId, loadDoc])

  const canEdit = myRole === "owner" || myRole === "editor"
  const addExpense = async () => {
    if (!canEdit) return
    if (!fWho || !fCat || !fDate || !fVal) return
    const exp = {
      id: null, who: fWho, category: fCat,
      amount: Number(String(fVal).replace(",", "."))||0,
      desc: fDesc || "", date: fDate, projectId: activeProjectId
    }
    const nextExpenses = [...expensesActive, exp]
    await savePatch({ expenses: nextExpenses })
    setFDesc(""); setFVal("")
  }
  const onKeyDownAdd = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addExpense()
    }
  }

  const addCategory = async (name, parentId=null) => {
    if (!canEdit) return
    const exists = (doc.categories||[]).find(c => c.name.toLowerCase() === name.toLowerCase())
    const next = exists ? doc.categories : [...doc.categories, stableCat(doc.categories, name)]
    await savePatch({ categories: next })
  }
  const renameCategory = async (id, newName) => {
    if (!canEdit) return
    const next = (doc.categories||[]).map(c => c.id===id ? { ...c, name:newName } : c)
    await savePatch({ categories: next })
  }
  const recolorCategory = async (id, color) => {
    if (!canEdit) return
    const next = (doc.categories||[]).map(c => c.id===id ? { ...c, color } : c)
    await savePatch({ categories: next })
  }
  const setParent = async (id, parentId) => {
    if (!canEdit) return
    if (id===parentId) return
    const next = (doc.categories||[]).map(c => c.id===id ? { ...c, parentId: parentId||null } : c)
    await savePatch({ categories: next })
  }
  const moveCat = async (id, dir) => {
    if (!canEdit) return
    const list = [...(doc.categories||[])].sort((a,b)=>(a.order??0)-(b.order??0))
    const idx = list.findIndex(c=>c.id===id)
    if (idx<0) return
    const j = dir==="up" ? Math.max(0, idx-1) : Math.min(list.length-1, idx+1)
    ;[list[idx].order, list[j].order] = [list[j].order, list[idx].order]
    await savePatch({ categories: list })
  }

  const project = doc?.projects?.find(p => p.id === activeProjectId)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("viewer")

  const addMember = async () => {
    if (myRole !== "owner") return
    const res = await fetch(`/api/family/${slug}/projects/${activeProjectId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })
    const j = await res.json()
    if (!j.ok) alert("Erro: "+(j.error||""))
    setInviteEmail("")
    await loadDoc()
  }
  const changeMemberRole = async (email, role) => {
    if (myRole !== "owner") return
    const res = await fetch(`/api/family/${slug}/projects/${activeProjectId}/members`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    })
    const j = await res.json()
    if (!j.ok) alert("Erro: "+(j.error||""))
    await loadDoc()
  }
  const removeMember = async (email) => {
    if (myRole !== "owner") return
    const res = await fetch(`/api/family/${slug}/projects/${activeProjectId}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
    const j = await res.json()
    if (!j.ok) alert("Erro: "+(j.error||""))
    await loadDoc()
  }

  const pieData = useMemo(() => {
    return Object.entries(totals.byCat).map(([catId, v]) => {
      const c = categoriesById.get(catId)
      return { name: c?.name || "?", value: v, color: c?.color || "#888" }
    }).sort((a,b)=> b.value-a.value)
  }, [totals, categoriesById])

  if (status !== "authenticated") {
    return <div className="p-6">Faça login para continuar.</div>
  }
  if (!doc) return <div className="p-6">Carregando…</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Gastos em Família</h1>
          <p className="text-xs opacity-70">Projeto selecionado: <b>{project?.name}</b> — Papel: <b>{myRole}</b></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Alternar tema">
            Tema: {theme==="dark"?"Escuro":"Claro"}
          </button>
          {myRole==="owner" && (
            <button onClick={()=>setShowShare(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Compartilhar</button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <label className="text-xs">Projeto:</label>
        <select className="px-2 py-1 rounded border dark:bg-slate-900" value={activeProjectId||""} onChange={e=>{ setActiveProjectId(e.target.value); setOnlyCategoryId(null) }}>
          {(doc.projects||[]).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <label className="text-xs">Período:</label>
        <input aria-label="Mês" className="px-2 py-1 rounded border dark:bg-slate-900" type="month" value={month} onChange={e=>setMonth(e.target.value)} />
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <label className="text-xs">Escopo:</label>
        <select className="px-2 py-1 rounded border dark:bg-slate-900" value={viewScope} onChange={e=>setViewScope(e.target.value)}>
          <option value="month">Mês</option>
          <option value="project">Projeto inteiro</option>
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input aria-label="Data" disabled={!canEdit} className="px-2 py-2 rounded border dark:bg-slate-900" type="date" value={fDate} onChange={e=>setFDate(e.target.value)} />
        <select aria-label="Pessoa" disabled={!canEdit} className="px-2 py-2 rounded border dark:bg-slate-900" value={fWho} onChange={e=>setFWho(e.target.value)}>
          {(doc.people||[]).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Categoria" disabled={!canEdit} className="px-2 py-2 rounded border dark:bg-slate-900" value={fCat} onChange={e=>setFCat(e.target.value)}>
          {(doc.categories||[]).sort((a,b)=>(a.order??0)-(b.order??0)).map(c => (
            <option key={c.id} value={c.id}>
              {c.parentId ? "— " : ""}{c.name}
            </option>
          ))}
        </select>
        <input aria-label="Descrição" disabled={!canEdit} className="px-2 py-2 rounded border dark:bg-slate-900 md:col-span-2" placeholder="Descrição" value={fDesc} onChange={e=>setFDesc(e.target.value)} onKeyDown={onKeyDownAdd} />
        <input aria-label="Valor" disabled={!canEdit} className="px-2 py-2 rounded border dark:bg-slate-900" placeholder="0,00" value={fVal} onChange={e=>setFVal(e.target.value)} onKeyDown={onKeyDownAdd} />
        <div className="md:col-span-6 flex justify-end">
          <button disabled={!canEdit} onClick={addExpense} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">Adicionar</button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Categorias</h2>
          {canEdit && (
            <div className="flex gap-2">
              <input aria-label="Nova categoria" className="px-2 py-1 rounded border dark:bg-slate-900" placeholder="Nova categoria…" id="newCatName" />
              <button className="px-3 py-1 rounded bg-slate-700 text-white" onClick={()=>{
                const el = document.getElementById("newCatName")
                const v = (el?.value||"").trim()
                if (v) addCategory(v)
                if (el) el.value=""
              }}>Adicionar</button>
            </div>
          )}
        </div>

        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {(doc.categories||[]).sort((a,b)=>(a.order??0)-(b.order??0)).map(c => (
            <div key={c.id} className={`rounded border dark:border-slate-700 p-2 ${onlyCategoryId===c.id ? "ring-2 ring-blue-500" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{background:c.color}} aria-hidden />
                  <input
                    className="bg-transparent outline-none border-b border-transparent focus:border-slate-400 dark:focus:border-slate-600"
                    value={c.name}
                    onChange={e=>renameCategory(c.id, e.target.value)}
                    disabled={!canEdit}
                    aria-label={`Nome da categoria ${c.name}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input type="color" value={c.color} onChange={e=>recolorCategory(c.id, e.target.value)} disabled={!canEdit} aria-label={`Cor da categoria ${c.name}`} />
                  <button className="px-2 py-0.5 rounded border text-xs" onClick={()=>moveCat(c.id,"up")} disabled={!canEdit}>↑</button>
                  <button className="px-2 py-0.5 rounded border text-xs" onClick={()=>moveCat(c.id,"down")} disabled={!canEdit}>↓</button>
                  <button className="px-2 py-0.5 rounded border text-xs" onClick={()=> setOnlyCategoryId(onlyCategoryId===c.id?null:c.id)}>
                    {onlyCategoryId===c.id ? "Mostrar todas" : "Ver só esta"}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs opacity-70">Sub de:</label>
                <select className="px-2 py-1 rounded border dark:bg-slate-900" value={c.parentId||""} onChange={e=>setParent(c.id, e.target.value || null)} disabled={!canEdit}>
                  <option value="">— Nenhuma —</option>
                  {(doc.categories||[]).filter(x=>x.id!==c.id).map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold">Despesas {viewScope==="month" ? `— ${monthLabel(month)}` : "(projeto inteiro)"} — Total: {currency(totals.total)}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b dark:border-slate-700">
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Pessoa</th>
                <th className="py-2 pr-2">Categoria</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {expensesActive.map(e => {
                const c = categoriesById.get(e.category)
                return (
                  <tr key={e.id} className="border-b dark:border-slate-800">
                    <td className="py-1 pr-2">{fmtDate(e.date)}</td>
                    <td className="py-1 pr-2">{e.who}</td>
                    <td className="py-1 pr-2"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background:c?.color||"#999"}} />{c?.name||"—"}</span></td>
                    <td className="py-1 pr-2">{e.desc}</td>
                    <td className="py-1 pr-2 text-right">{currency(e.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="rounded border dark:border-slate-700 p-3">
          <h3 className="font-semibold mb-2">Gastos por Categoria</h3>
          <PieChart width={380} height={280}>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(d)=>`${d.name}: ${currency(d.value)}`}>
              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <RTooltip formatter={(v, n)=>[currency(v), n]} />
            <RLegend />
          </PieChart>
        </div>

        <div className="rounded border dark:border-slate-700 p-3">
          <h3 className="font-semibold mb-2">Evolução Mensal (Total)</h3>
          <LineChart width={420} height={280} data={monthsSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={monthLabel} />
            <YAxis />
            <RTooltip formatter={(v, n, p)=> n==="mm3" ? [currency(v), "Média Móvel 3M"] : [currency(v), "Total"]}
              labelFormatter={(l, p)=> {
                const mom = p?.payload?.[0]?.payload?.mom
                return `Mês: ${monthLabel(l)} | Variação MoM: ${mom!=null ? mom.toFixed(1)+"%" : "—"}`
              }} />
            <Line type="monotone" dataKey="total" dot strokeWidth={2} />
            <Line type="monotone" dataKey="mm3" strokeDasharray="5 5" />
          </LineChart>
        </div>

        <div className="rounded border dark:border-slate-700 p-3 md:col-span-2">
          <h3 className="font-semibold mb-2">Gastos por Pessoa (mensal)</h3>
          <BarChart width={860} height={300} data={monthsByPerson}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={monthLabel} />
            <YAxis />
            <RTooltip formatter={(v, n)=>[currency(v), n]} />
            {(doc.people||[]).map((p, idx)=>(
              <Bar key={p} dataKey={p} stackId="a" fill={`hsl(${(idx*67)%360} 70% 48%)`} />
            ))}
          </BarChart>
        </div>
      </div>

      {showShare && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label="Compartilhar projeto">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 w-full max-w-lg border dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Compartilhar — {project?.name}</h3>
              <button onClick={()=>setShowShare(false)} className="px-2 py-1 rounded border">Fechar</button>
            </div>
            <div className="mt-3">
              <p className="text-xs opacity-70">Owner: <b>{project?.owner || "—"}</b></p>
              <div className="mt-2">
                <h4 className="font-medium">Membros</h4>
                <div className="mt-1 space-y-2">
                  {(project?.members||[]).length===0 && <div className="text-xs opacity-70">Nenhum membro ainda.</div>}
                  {(project?.members||[]).map(m => (
                    <div key={m.email} className="flex items-center justify-between gap-2">
                      <span className="truncate">{m.email}</span>
                      {myRole==="owner" ? (
                        <div className="flex items-center gap-2">
                          <select className="px-2 py-1 rounded border dark:bg-slate-900" value={m.role} onChange={e=>changeMemberRole(m.email, e.target.value)}>
                            <option value="viewer">viewer</option>
                            <option value="editor">editor</option>
                          </select>
                          <button className="px-2 py-1 rounded bg-red-600 text-white" onClick={()=>removeMember(m.email)}>Remover</button>
                        </div>
                      ) : (
                        <span className="text-xs opacity-70">{m.role}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {myRole==="owner" && (
                <div className="mt-4 border-t dark:border-slate-700 pt-3">
                  <h4 className="font-medium">Convidar por e-mail</h4>
                  <div className="mt-2 flex items-center gap-2">
                    <input className="px-2 py-1 rounded border dark:bg-slate-900 flex-1" placeholder="email@exemplo.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} />
                    <select className="px-2 py-1 rounded border dark:bg-slate-900" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                    <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={addMember}>Adicionar</button>
                  </div>
                  <p className="text-[11px] opacity-70 mt-1">Obs: por enquanto o convite é direto (sem e-mail). A pessoa precisa fazer login com esse e-mail.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
