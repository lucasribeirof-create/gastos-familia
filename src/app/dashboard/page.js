"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { carregarFamilia, salvarFamilia } from "../actions"

export default function Page() {
  const { status, data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/")
  }, [status, router])

  if (status !== "authenticated") {
    return <main style={{display:"grid",placeItems:"center",height:"100vh"}}>Carregando…</main>
  }

  return <GastosApp user={session.user} onSignOut={() => signOut()} />
}

/* ===================== App ===================== */

function currency(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function GastosApp({ user, onSignOut }) {
  // ----- Família (slug) -----
  const [slugInput, setSlugInput] = useState("")
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // ----- Documento (na nuvem) -----
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState(["Mercado", "Carro", "Aluguel", "Lazer"])
  const [expenses, setExpenses] = useState([])

  // ----- Filtros e inputs -----
  const [newPerson, setNewPerson] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [who, setWho] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [desc, setDesc] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterCat, setFilterCat] = useState("Todos")

  // ----- Cálculos -----
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const perHead = people.length > 0 ? total / people.length : 0

  const paidBy = useMemo(() => {
    const map = {}
    people.forEach((p) => (map[p] = 0))
    expenses.forEach((e) => { map[e.who] = (map[e.who] || 0) + e.amount })
    return map
  }, [expenses, people])

  const balances = useMemo(
    () => people.map((p) => ({ person: p, balance: (paidBy[p] || 0) - perHead })),
    [people, paidBy, perHead]
  )

  const settlements = useMemo(() => {
    const debtors = balances.filter(b => b.balance < -0.01).map(b => ({ person: b.person, value: -b.balance }))
    const creditors = balances.filter(b => b.balance > 0.01).map(b => ({ person: b.person, value: b.balance }))
    const moves = []
    let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].value, creditors[j].value)
      moves.push({ from: debtors[i].person, to: creditors[j].person, value: pay })
      debtors[i].value -= pay
      creditors[j].value -= pay
      if (debtors[i].value <= 0.01) i++
      if (creditors[j].value <= 0.01) j++
    }
    return moves
  }, [balances])

  // ----- Carregar slug salvo e documento inicial -----
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("familySlug") : ""
    const initial = stored || ""
    setSlug(initial)
    setSlugInput(initial)
    if (initial) {
      ;(async () => {
        setLoading(true)
        setError("")
        try {
          const doc = await carregarFamilia(initial)
          setPeople(doc.people || [])
          setCategories(doc.categories || ["Mercado", "Carro", "Aluguel", "Lazer"])
          setExpenses(doc.expenses || [])
        } catch (e) {
          setError(String(e.message || e))
        } finally {
          setLoading(false)
        }
      })()
    } else {
      setLoading(false)
    }
  }, [])

  // ----- Trocar/definir família -----
  const aplicarSlug = useCallback(async () => {
    const s = slugInput.trim().toLowerCase()
    if (!s) return
    setSlug(s)
    localStorage.setItem("familySlug", s)
    setLoading(true)
    setError("")
    try {
      const doc = await carregarFamilia(s)
      setPeople(doc.people || [])
      setCategories(doc.categories || ["Mercado", "Carro", "Aluguel", "Lazer"])
      setExpenses(doc.expenses || [])
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [slugInput])

  // ----- Autosave com debounce -----
  const saveTimer = useRef(null)
  const queueSave = useCallback((next) => {
    if (!slug) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      setError("")
      try {
        await salvarFamilia(slug, {
          people: next.people,
          categories: next.categories,
          expenses: next.expenses,
        })
      } catch (e) {
        setError(String(e.message || e))
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [slug])

  // ----- Helpers para alterar estado + salvar -----
  const setDocAndSave = useCallback((updater) => {
    const next = {
      people, categories, expenses
    }
    updater(next)
    setPeople(next.people)
    setCategories(next.categories)
    setExpenses(next.expenses)
    queueSave(next)
  }, [people, categories, expenses, queueSave])

  // ----- Ações -----
  function addPerson() {
    const name = newPerson.trim()
    if (!name) return
    if (people.includes(name)) return
    setDocAndSave(d => {
      d.people = [...d.people, name]
    })
    setNewPerson("")
    if (!who) setWho(name)
  }

  function removePerson(name) {
    if (!people.includes(name)) return
    setDocAndSave(d => {
      d.people = d.people.filter(p => p !== name)
      d.expenses = d.expenses.filter(e => e.who !== name)
    })
    if (who === name) setWho("")
  }

  function addCategory() {
    const cat = newCategory.trim()
    if (!cat) return
    if (categories.includes(cat)) return
    setDocAndSave(d => {
      d.categories = [...d.categories, cat]
    })
    setNewCategory("")
    if (!category) setCategory(cat)
  }

  function addExpense() {
    const amt = Number(String(amount).replace(",", "."))
    if (!who || !category || !amt || isNaN(amt)) return
    const e = { id: crypto.randomUUID(), who, category, amount: amt, desc: desc.trim(), date }
    setDocAndSave(d => {
      d.expenses = [e, ...d.expenses]
    })
    setAmount("")
    setDesc("")
  }

  function removeExpense(id) {
    setDocAndSave(d => {
      d.expenses = d.expenses.filter(e => e.id !== id)
    })
  }

  function resetAll() {
    if (!confirm("Apagar TODOS os dados desta família na nuvem?")) return
    const cleared = {
      people: [],
      categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
      expenses: [],
    }
    setPeople(cleared.people)
    setCategories(cleared.categories)
    setExpenses(cleared.expenses)
    queueSave(cleared)
    setWho("")
    setCategory("")
    setAmount("")
    setDesc("")
  }

  const filteredExpenses = expenses.filter((e) => filterCat === "Todos" || e.category === filterCat)

  // ----- UI -----
  if (!slug) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-5 space-y-4">
          <h1 className="text-xl font-bold">Conectar à família</h1>
          <p className="text-sm text-slate-600">
            Digite um código para sua família (ex.: <b>familia-ribeiro</b>). Quem usar o mesmo código verá os mesmos dados.
          </p>
          <input
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="ex.: familia-ribeiro"
            className="w-full px-3 py-2 rounded-xl border"
          />
          <button
            onClick={aplicarSlug}
            className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white"
          >
            Usar este código
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </main>
    )
  }

  if (loading) {
    return <main className="min-h-screen grid place-items-center">Carregando dados…</main>
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gastos em Família</h1>
            <div className="text-xs text-slate-500">
              Família: <b>{slug}</b> {saving && <span className="ml-2 text-emerald-600">salvando…</span>}
              {error && <span className="ml-2 text-red-600">erro: {error}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden sm:block">{user?.name}</span>
            <input
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="trocar família…"
              className="px-3 py-2 rounded-xl border hidden md:block"
              style={{minWidth:220}}
            />
            <button onClick={aplicarSlug} className="px-3 py-2 rounded-2xl border text-sm hidden md:inline-flex">
              Trocar família
            </button>
            <button onClick={resetAll} className="px-3 py-2 rounded-2xl bg-red-100 text-red-700 hover:bg-red-200 text-sm">
              Limpar tudo
            </button>
            <button onClick={onSignOut} className="px-3 py-2 rounded-2xl border text-sm">
              Sair
            </button>
          </div>
        </header>

        {/* Pessoas & Categorias */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">1) Pessoas do grupo</h2>
            <div className="flex gap-2 mb-3">
              <input
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                placeholder="Nome (ex.: Ana)"
                className="flex-1 px-3 py-2 rounded-xl border"
              />
              <button onClick={addPerson} className="px-4 py-2 rounded-xl bg-blue-600 text-white">
                Adicionar
              </button>
            </div>
            {people.length === 0 ? (
              <p className="text-sm text-slate-500">Adicione pelo menos 2 pessoas.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <li key={p} className="px-2 py-1 bg-slate-100 rounded-full text-sm flex items-center gap-2">
                    <span className="pl-1">{p}</span>
                    <button
                      onClick={() => removePerson(p)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50"
                      title={`Remover ${p}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">2) Categorias</h2>
            <div className="flex gap-2 mb-3">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria (ex.: Remédios)"
                className="flex-1 px-3 py-2 rounded-xl border"
              />
              <button onClick={addCategory} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Todos", ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`px-3 py-1 rounded-full text-sm border ${filterCat === c ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Nova despesa */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">3) Adicionar despesa</h2>
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Quem pagou</label>
              <select value={who} onChange={(e) => setWho(e.target.value)} className="w-full px-3 py-2 rounded-xl border">
                <option value="">Selecione</option>
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border">
                <option value="">Selecione</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Valor (R$)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 rounded-xl border"
                inputMode="decimal"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Descrição</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ex.: feira do mês"
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border" />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button onClick={addExpense} className="px-5 py-2 rounded-xl bg-blue-600 text-white">
                Lançar
              </button>
            </div>
          </div>
        </section>

        {/* Lista e totais */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">
              Despesas {filterCat !== "Todos" && <span className="text-slate-500">({filterCat})</span>}
            </h2>
            {filteredExpenses.length === 0 ? (
              <p className="text-sm text-slate-500">Sem despesas ainda.</p>
            ) : (
              <ul className="divide-y">
                {filteredExpenses.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{e.desc || e.category}</div>
                      <div className="text-xs text-slate-500">
                        {e.category} • {e.who} • {new Date(e.date).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="w-28 text-right font-semibold">{currency(e.amount)}</div>
                    <button onClick={() => removeExpense(e.id)} className="text-red-600 text-sm hover:underline">
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div>
              <h2 className="font-semibold mb-2">Resumo</h2>
              <div className="text-sm flex justify-between">
                <span>Total</span>
                <span className="font-semibold">{currency(total)}</span>
              </div>
              <div className="text-sm flex justify-between">
                <span>Por pessoa ({people.length || 0})</span>
                <span className="font-semibold">{currency(perHead || 0)}</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Quem pagou quanto</h3>
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
              <h3 className="font-semibold mb-2">Acertos</h3>
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
          Dica: use o mesmo <b>código da família</b> em aparelhos diferentes para compartilhar os dados.
        </footer>
      </div>
    </div>
  )
}
