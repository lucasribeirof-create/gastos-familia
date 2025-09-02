"use client";

export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as NextAuth from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

// =============== utils básicas ===============
const currency = (v) =>
  Number.isFinite(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
const todayYYYYMM = () => new Date().toISOString().slice(0, 7);
const isoToday = () => new Date().toISOString().slice(0, 10);
const monthKey = (dateStr) => (dateStr ? String(dateStr).slice(0, 7) : "");
const monthLabel = (yyyyMM) => (/^\d{4}-\d{2}$/.test(yyyyMM) ? `${yyyyMM.slice(5, 7)}/${yyyyMM.slice(0, 4)}` : yyyyMM || "");
const hash36 = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i); return (h >>> 0).toString(36); };
const slugFromEmail = (email) => `fam-${hash36(String(email || "").trim().toLowerCase())}`;

// cor única e estável por categoria (HSL baseado em hash)
function hslFromString(s) {
  const base = parseInt(hash36(s), 36);
  const h = base % 360;
  const sat = 55 + (base % 10); // 55–64
  const light = 45 + (base % 8); // 45–52
  return `hsl(${h} ${sat}% ${light}%)`;
}

function ChartsErrorBoundary({ children }) {
  const [crashed, setCrashed] = useState(false);
  return crashed ? (
    <div className="h-64 grid place-items-center text-sm text-red-600">Erro ao renderizar gráficos.</div>
  ) : (
    <ErrorCatcher onError={() => setCrashed(true)}>{children}</ErrorCatcher>
  );
}
class ErrorCatcher extends React.Component {
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.props.children; }
}

// =============== página ===============
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Carregando…</div>}>
      <Dashboard />
    </Suspense>
  );
}

export function Dashboard() {
  const useS = NextAuth?.useSession;
  const sess = typeof useS === "function" ? useS() : { data: null, status: "unauthenticated" };
  const session = (sess && "data" in sess) ? sess.data : null;
  const status = (sess && "status" in sess) ? sess.status : "unauthenticated";

  const router = useRouter();
  const search = useSearchParams();

  // estado do documento
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [people, setPeople] = useState([]); // ["Lucas","Katy",...]
  const [categories, setCategories] = useState(["Mercado", "Carro", "Aluguel", "Lazer"]);
  const [projects, setProjects] = useState([]); // [{id,name,type,start,end,status,members:[{email,role}]}]
  const [expenses, setExpenses] = useState([]); // [{id,who,category,amount,desc,date,projectId}]
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // filtros e UI
  const [period, setPeriod] = useState(todayYYYYMM()); // "ALL" ou "YYYY-MM"
  const [filterPerson, setFilterPerson] = useState("Todas");
  const [filterCategory, setFilterCategory] = useState("Todas");
  const [orderMode, setOrderMode] = useState("cat"); // "cat" | "date-asc" | "date-desc"
  const [chartType, setChartType] = useState("pizza"); // "pizza" | "linha"

  // inputs do gasto
  const [date, setDate] = useState(isoToday());
  const [who, setWho] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  // convite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");

  // criação de projeto
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState("monthly"); // monthly | custom
  const [newProjectStart, setNewProjectStart] = useState(isoToday());

  const myEmail = (session?.user?.email || "").toLowerCase();
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const myRole = useMemo(() => {
    if (!selectedProject) return "none";
    const m = (selectedProject.members || []).find((x) => (x?.email || "").toLowerCase() === myEmail);
    // se não houver members ainda, assumimos owner (fase de migração)
    return m?.role || ((selectedProject.members || []).length === 0 ? "owner" : "none");
  }, [selectedProject, myEmail]);
  const readOnly = !(myRole === "owner" || myRole === "editor");

  // =============== carregar do backend ===============
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/dashboard");
      return;
    }
    if (status !== "authenticated") return;

    const famParam = search?.get("fam");
    const email = (session?.user?.email) || "";
    const computedSlug = famParam || slugFromEmail(email);

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/family/${computedSlug}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const doc = await res.json();

        setSlug(computedSlug);
        setPeople(Array.isArray(doc.people) ? doc.people : []);
        setCategories(Array.isArray(doc.categories) ? doc.categories : []);
        const projs = Array.isArray(doc.projects)
          ? doc.projects.map((p) => ({ ...p, members: Array.isArray(p.members) ? p.members : [] }))
          : [];
        setProjects(projs);
        setExpenses(Array.isArray(doc.expenses) ? doc.expenses : []);
        setSelectedProjectId(projs[0]?.id || "");
        setPeriod(todayYYYYMM());
      } catch (e) {
        console.error(e);
        setError("Falha ao carregar seus dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session, router, search]);

  // =============== salvar no backend ===============
  const saveDoc = useCallback(async (next) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/family/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        let msg = "Falha ao salvar.";
        try {
          const j = await res.json();
          if (j?.error || j?.message) msg = `${j.error || "Erro"}${j.message ? ` – ${j.message}` : ""}`;
        } catch {}
        throw new Error(msg);
      }
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [slug]);

  const setDocAndSave = useCallback((fn) => {
    if (readOnly) { alert("Somente leitura para seu papel."); return; }
    const next = fn({ people, categories, projects, expenses });
    setPeople(next.people); setCategories(next.categories);
    setProjects(next.projects); setExpenses(next.expenses);
    saveDoc(next);
  }, [people, categories, projects, expenses, readOnly, saveDoc]);

  // =============== ações: pessoas/categorias/membros ===============
  const addPerson = () => {
    const el = document.getElementById("newPerson");
    const v = (el?.value || "").trim();
    if (!v || people.includes(v)) return;
    setDocAndSave((d) => ({ ...d, people: [...d.people, v] }));
    if (el) el.value = "";
  };
  const removePerson = (name) => {
    const used = expenses.some((e) => e.who === name && e.projectId === selectedProjectId);
    if (used) return alert("Não é possível remover: existe despesa com essa pessoa.");
    setDocAndSave((d) => ({ ...d, people: d.people.filter((p) => p !== name) }));
    if (who === name) setWho("");
  };

  const addCategoryLocal = () => {
    const el = document.getElementById("newCat");
    const v = (el?.value || "").trim();
    if (!v || categories.includes(v)) return;
    setDocAndSave((d) => ({ ...d, categories: [...d.categories, v] }));
    if (el) el.value = "";
  };
  const removeCategory = (cat) => {
    const used = expenses.some((e) => e.category === cat && e.projectId === selectedProjectId);
    if (used) return alert("Não é possível remover: existe despesa com essa categoria.");
    setDocAndSave((d) => ({ ...d, categories: d.categories.filter((c) => c !== cat) }));
    if (category === cat) setCategory("");
  };

  // membros (compartilhamento simples)
  const addMember = () => {
    const email = (inviteEmail || "").trim().toLowerCase();
    if (!email || !selectedProject) return;
    setDocAndSave((d) => {
      d.projects = d.projects.map((p) => {
        if (p.id !== selectedProject.id) return p;
        const members = Array.isArray(p.members) ? p.members : [];
        if (members.some((m) => (m.email || "").toLowerCase() === email)) return p;
        return { ...p, members: [...members, { email, role: inviteRole }] };
      });
      return d;
    });
    setInviteEmail("");
  };
  const removeMember = (email) => {
    if (!selectedProject) return;
    setDocAndSave((d) => {
      d.projects = d.projects.map((p) => {
        if (p.id !== selectedProject.id) return p;
        return { ...p, members: (p.members || []).filter((m) => (m.email || "").toLowerCase() !== email) };
      });
      return d;
    });
  };

  // =============== projetos: criar / remover ===============
  const createProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = "proj-" + Math.random().toString(36).slice(2, 8);
    const proj = {
      id,
      name,
      type: newProjectType,
      start: newProjectStart || isoToday(),
      end: "",
      status: "open",
      members: [{ email: myEmail, role: "owner" }],
    };
    setDocAndSave((d) => {
      const next = { ...d, projects: [...d.projects, proj] };
      return next;
    });
    setSelectedProjectId(id);
    setNewProjectName("");
  };

  const deleteProject = () => {
    if (!selectedProject) return;
    if (myRole !== "owner") { alert("Apenas o owner pode excluir o projeto."); return; }
    if (!confirm(`Remover o projeto "${selectedProject.name}"? Esta ação também remove as despesas desse projeto.`)) return;

    setDocAndSave((d) => {
      const remaining = d.projects.filter((p) => p.id !== selectedProject.id);
      const expRemaining = d.expenses.filter((e) => e.projectId !== selectedProject.id);
      // escolhe outro projeto se existir
      const nextSelected = remaining[0]?.id || "";
      setSelectedProjectId(nextSelected);
      return { ...d, projects: remaining, expenses: expRemaining };
    });
  };

  // =============== despesas ===============
  const addExpense = () => {
    if (!selectedProject) { alert("Crie/Selecione um projeto."); return; }
    const value = Number(String(amount).replace(",", "."));
    if (!who || !category || !Number.isFinite(value) || value <= 0 || !date) return;
    const e = {
      id: "exp-" + Math.random().toString(36).slice(2, 9),
      who, category, amount: value, desc: (desc || "").trim(),
      date, projectId: selectedProjectId
    };
    setDocAndSave((d) => ({ ...d, expenses: [...d.expenses, e] }));
    setWho(""); setCategory(""); setAmount(""); setDesc("");
  };
  const removeExpense = (id) => {
    setDocAndSave((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
  };

  // =============== derivados p/ UI (filtros/agrupamentos) ===============
  const projectExpenses = useMemo(
    () => expenses.filter((e) => e.projectId === selectedProjectId),
    [expenses, selectedProjectId]
  );
  const months = useMemo(() => {
    const set = new Set(projectExpenses.map((e) => monthKey(e.date)));
    return ["ALL", ...[...set].filter(Boolean).sort()];
  }, [projectExpenses]);

  const filtered = useMemo(() => projectExpenses
    .filter((e) => (period === "ALL" || monthKey(e.date) === period))
    .filter((e) => (filterPerson === "Todas" ? true : e.who === filterPerson))
    .filter((e) => (filterCategory === "Todas" ? true : e.category === filterCategory)),
    [projectExpenses, period, filterPerson, filterCategory]
  );

  const sortedByDateAsc = useMemo(
    () => [...filtered].sort((a, b) => a.date.localeCompare(b.date)),
    [filtered]
  );
  const sortedByDateDesc = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered]
  );

  const groupedByCategory = useMemo(() => {
    const m = new Map();
    sortedByDateAsc.forEach((e) => {
      const arr = m.get(e.category) || [];
      arr.push(e);
      m.set(e.category, arr);
    });
    return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [sortedByDateAsc]);

  // totais / quem pagou quanto / rateio
  const totalPeriodo = useMemo(
    () => filtered.reduce((s, e) => s + (e.amount || 0), 0),
    [filtered]
  );
  const porPessoa = useMemo(() => {
    const m = new Map();
    filtered.forEach((e) => m.set(e.who, (m.get(e.who) || 0) + (e.amount || 0)));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);
  const porCategoria = useMemo(() => {
    const m = new Map();
    filtered.forEach((e) => m.set(e.category, (m.get(e.category) || 0) + (e.amount || 0)));
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const rateio = useMemo(() => {
    // todos do grupo participam igualmente
    const participantes = people.length > 0 ? people : [...new Set(filtered.map((e) => e.who))];
    if (participantes.length === 0) return { share: 0, bal: [], acertos: [] };
    const share = totalPeriodo / participantes.length;

    // quanto cada um pagou no período filtrado
    const pagou = new Map();
    participantes.forEach((p) => pagou.set(p, 0));
    filtered.forEach((e) => { pagou.set(e.who, (pagou.get(e.who) || 0) + (e.amount || 0)); });

    const bal = participantes.map((p) => ({ pessoa: p, delta: (pagou.get(p) || 0) - share }));
    // devedores (delta<0) pagam para credores (delta>0)
    const cred = [...bal].filter((b) => b.delta > 0).sort((a, b) => b.delta - a.delta);
    const dev = [...bal].filter((b) => b.delta < 0).sort((a, b) => a.delta - b.delta);
    const acertos = [];
    let i = 0, j = 0;
    while (i < dev.length && j < cred.length) {
      const pode = Math.min(cred[j].delta, -dev[i].delta);
      if (pode > 0.0001) {
        acertos.push({ de: dev[i].pessoa, para: cred[j].pessoa, valor: pode });
        cred[j].delta -= pode;
        dev[i].delta += pode;
      }
      if (Math.abs(cred[j].delta) < 0.0001) j++;
      if (Math.abs(dev[i].delta) < 0.0001) i++;
    }
    return { share, bal, acertos };
  }, [filtered, totalPeriodo, people]);

  // séries p/ gráficos
  const serieMensal = useMemo(() => {
    const m = new Map();
    projectExpenses.forEach((e) => {
      const k = monthKey(e.date);
      m.set(k, (m.get(k) || 0) + (e.amount || 0));
    });
    const arr = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));
    for (let i = 0; i < arr.length; i++) {
      const w = arr.slice(Math.max(0, i - 2), i + 1).map((x) => x.total);
      arr[i].mm3 = w.length ? (w.reduce((a, b) => a + b, 0) / w.length) : arr[i].total;
    }
    return arr;
  }, [projectExpenses]);

  // ==== UI helpers ====
  if (status !== "authenticated") return <div className="p-6">Redirecionando…</div>;
  if (loading) return <div className="p-6">Carregando dados…</div>;

  const card = "rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm";
  const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40";
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/dashboard?fam=${slug}` : `/dashboard?fam=${slug}`;

  // =============== render ===============
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto text-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gastos em Família</h1>
          <p className="text-xs opacity-70">
            Projeto: <b>{(projects.find(p => p.id === selectedProjectId)?.name) || "—"}</b>
            {" · "}Seu papel: <b>{myRole}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => NextAuth.signOut({ callbackUrl: "/" })}
                  className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            Sair
          </button>
        </div>
      </div>

      {/* Projeto + Compartilhar */}
      <div className={`mt-4 p-3 ${card}`}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* Seleção + ações projeto */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Projeto</div>
            <div className="flex gap-2">
              <select className="px-3 py-2 rounded-xl border dark:border-slate-700 dark:bg-slate-900 flex-1"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name} {p.status === "closed" ? "(fechado)" : ""}</option>)}
              </select>
              {myRole === "owner" && (
                <button onClick={deleteProject}
                        className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10">
                  Excluir
                </button>
              )}
            </div>

            {myRole === "owner" && (
              <div className="mt-3">
                <div className="text-xs font-medium mb-1">Criar novo projeto</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input className="px-3 py-2 rounded-xl border dark:bg-slate-900 md:col-span-2" placeholder="Nome (ex.: Viagem SP)"
                         value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                  <select className="px-3 py-2 rounded-xl border dark:bg-slate-900"
                          value={newProjectType} onChange={(e) => setNewProjectType(e.target.value)}>
                    <option value="monthly">Mensal</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input type="date" className="px-3 py-2 rounded-xl border dark:bg-slate-900"
                         value={newProjectStart} onChange={(e) => setNewProjectStart(e.target.value)} />
                </div>
                <div className="mt-2">
                  <button onClick={createProject}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                    Criar projeto
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Compartilhar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Compartilhar com pessoas</div>
            <div className="flex gap-2">
              <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="email@dominio.com"
                     value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      onClick={addMember}>Adicionar</button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(selectedProject?.members || []).map((m) => (
                <span key={m.email} className={chip}>
                  {m.email} <span className="opacity-60">({m.role})</span>
                  {!readOnly && (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => removeMember(m.email)}>remover</button>
                  )}
                </span>
              ))}
              {(selectedProject?.members || []).length === 0 && <span className="opacity-60 text-xs">Nenhum membro ainda.</span>}
            </div>
          </div>

          {/* Link */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="font-semibold mb-2">Link do projeto</div>
            <div className="flex gap-2">
              <input readOnly className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" value={shareLink} />
              <button className="px-4 py-2 rounded-xl border" onClick={() => navigator.clipboard?.writeText(shareLink)}>Copiar</button>
            </div>
            <div className="mt-2 text-xs opacity-70">Envie esse link para os convidados (eles precisam logar com o mesmo e-mail).</div>
          </div>
        </div>
      </div>

      {/* Pessoas / Categorias */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">Pessoas do grupo</h3>
          <div className="flex gap-2">
            <input id="newPerson" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nome (ex.: Ana)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={addPerson}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map((p) => (
              <span key={p} className={chip}>
                {p}
                {!readOnly && <button className="text-xs text-red-600 hover:underline" onClick={() => removePerson(p)}>remover</button>}
              </span>
            ))}
            {people.length === 0 && <span className="opacity-60 text-xs">Sem pessoas ainda.</span>}
          </div>
        </div>

        <div className={`p-3 ${card}`}>
          <h3 className="font-semibold mb-2">Categorias</h3>
          <div className="flex gap-2">
            <input id="newCat" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 flex-1" placeholder="Nova categoria (ex.: Remédios)" />
            <button disabled={readOnly} className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={addCategoryLocal}>Adicionar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c} className={chip}>
                {c}
                {!readOnly && <button className="text-xs text-red-600 hover:underline" onClick={() => removeCategory(c)}>remover</button>}
              </span>
            ))}
            {categories.length === 0 && <span className="opacity-60 text-xs">Sem categorias ainda.</span>}
          </div>
        </div>
      </div>

      {/* Adicionar gasto */}
      <div className={`mt-4 p-3 ${card}`}>
        <h3 className="font-semibold mb-2">Adicionar gasto</h3>
        <p className="text-xs opacity-70 mb-3">Adicione o gasto aqui 😉</p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <input type="date" disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={date} onChange={(e) => setDate(e.target.value)} />
          <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Quem pagou?</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Categoria</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 md:col-span-2" placeholder="Descrição"
                 value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpense(); } }} />
          <div className="flex gap-2">
            <input disabled={readOnly} className="px-3 py-2 rounded-xl border dark:bg-slate-900 w-full" placeholder="0,00"
                   value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpense(); } }} />
            <button disabled={readOnly} onClick={addExpense} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap disabled:opacity-50">Lançar</button>
          </div>
        </div>
      </div>

      {/* DESPESAS */}
      <div className="mt-6 font-semibold text-lg">Despesas</div>
      <div className={`mt-2 p-3 ${card}`}>
        {/* filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Período:</span>
            <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {["ALL", ...months.filter((m) => m !== "ALL")].map((m) => (
                <option key={m} value={m}>{m === "ALL" ? "Total" : monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Pessoa:</span>
            <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
              {["Todas", ...people].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Categoria:</span>
            <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              {["Todas", ...categories].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Ordenação:</span>
            <select className="px-3 py-2 rounded-xl border dark:bg-slate-900" value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
              <option value="cat">Por categoria (agrupado)</option>
              <option value="date-asc">Por data (asc)</option>
              <option value="date-desc">Por data (desc)</option>
            </select>
          </div>

          <div className="ml-auto text-xs opacity-70">
            Total do período: <b>{currency(totalPeriodo)}</b>
          </div>
        </div>

        {/* lista */}
        <div className="mt-3">
          {orderMode === "cat" ? (
            groupedByCategory.map(([cat, rows]) => (
              <div key={cat} className="mt-4">
                <div className="font-semibold mb-1">{cat} — {currency(rows.reduce((s, e) => s + (e.amount || 0), 0))}</div>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                      <tr className="[&>th]:py-2 [&>th]:px-3 text-left">
                        <th style={{width:120}}>Data</th>
                        <th style={{width:180}}>Pessoa</th>
                        <th>Descrição</th>
                        <th style={{width:140}} className="text-right">Valor</th>
                        <th style={{width:80}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e) => (
                        <tr key={e.id} className="border-t border-slate-200/70 dark:border-slate-800">
                          <td className="py-2 px-3">{e.date}</td>
                          <td className="py-2 px-3">{e.who}</td>
                          <td className="py-2 px-3">{e.desc || "-"}</td>
                          <td className="py-2 px-3 text-right">{currency(e.amount)}</td>
                          <td className="py-2 px-3 text-right">
                            {!readOnly && <button className="text-red-600 hover:underline" onClick={() => removeExpense(e.id)}>remover</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                  <tr className="[&>th]:py-2 [&>th]:px-3 text-left">
                    <th style={{width:120}}>Data</th>
                    <th style={{width:180}}>Pessoa</th>
                    <th style={{width:180}}>Categoria</th>
                    <th>Descrição</th>
                    <th style={{width:140}} className="text-right">Valor</th>
                    <th style={{width:80}}></th>
                  </tr>
                </thead>
                <tbody>
                  {(orderMode === "date-asc" ? sortedByDateAsc : sortedByDateDesc).map((e) => (
                    <tr key={e.id} className="border-t border-slate-200/70 dark:border-slate-800">
                      <td className="py-2 px-3">{e.date}</td>
                      <td className="py-2 px-3">{e.who}</td>
                      <td className="py-2 px-3">{e.category}</td>
                      <td className="py-2 px-3">{e.desc || "-"}</td>
                      <td className="py-2 px-3 text-right">{currency(e.amount)}</td>
                      <td className="py-2 px-3 text-right">
                        {!readOnly && <button className="text-red-600 hover:underline" onClick={() => removeExpense(e.id)}>remover</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RESUMOS */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-3 ${card}`}>
          <div className="font-semibold mb-2">Resumo</div>
          <div className="text-sm flex flex-col gap-1">
            <div className="flex justify-between"><span>Total</span><b>{currency(totalPeriodo)}</b></div>
            <div className="flex justify-between"><span>Por pessoa ({people.length || "-"})</span><b>{people.length ? currency(totalPeriodo / people.length) : "—"}</b></div>
          </div>
        </div>

        <div className={`p-3 ${card}`}>
          <div className="font-semibold mb-2">Quem pagou quanto</div>
          <div className="text-sm flex flex-col gap-1">
            {porPessoa.map((p) => (
              <div key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <b>{currency(p.value)}</b>
              </div>
            ))}
            {porPessoa.length === 0 && <div className="opacity-60 text-xs">Sem dados no período.</div>}
          </div>
        </div>

        <div className={`p-3 ${card}`}>
          <div className="font-semibold mb-2">Totais por categoria</div>
          <div className="text-sm flex flex-col gap-1">
            {porCategoria.map((c) => (
              <div key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <b>{currency(c.value)}</b>
              </div>
            ))}
            {porCategoria.length === 0 && <div className="opacity-60 text-xs">Sem dados no período.</div>}
          </div>
        </div>
      </div>

      {/* ACERTOS */}
      <div className={`mt-4 p-3 ${card}`}>
        <div className="font-semibold mb-2">Acertos (rateio)</div>
        {rateio.acertos.length === 0 ? (
          <div className="opacity-60 text-xs">Nada a acertar.</div>
        ) : (
          <div className="space-y-1 text-sm">
            {rateio.acertos.map((a, i) => (
              <div key={i}><b>{a.de}</b> deve pagar <b>{currency(a.valor)}</b> para <b>{a.para}</b></div>
            ))}
          </div>
        )}
      </div>

      {/* GRÁFICOS */}
      <div className={`mt-4 p-3 ${card}`}>
        <div className="flex items-center justify-between">
          <div className="font-semibold">Gráficos</div>
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1.5 rounded-xl border ${chartType === "pizza" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              onClick={() => setChartType("pizza")}>Pizza</button>
            <button className={`px-3 py-1.5 rounded-xl border ${chartType === "linha" ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              onClick={() => setChartType("linha")}>Linha</button>
          </div>
        </div>

        <ChartsErrorBoundary>
          <div className="h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "pizza" ? (
                <PieChart>
                  <Pie dataKey="value" data={porCategoria} cx="50%" cy="50%" outerRadius={100} label>
                    {porCategoria.map((entry, idx) => (
                      <Cell key={`c-${idx}`} fill={hslFromString(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(Number(v))} />
                </PieChart>
              ) : (
                <LineChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} />
                  <YAxis />
                  <Tooltip labelFormatter={monthLabel} formatter={(v) => currency(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey="total" />
                  <Line type="monotone" dataKey="mm3" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </ChartsErrorBoundary>
      </div>

      {/* STATUS */}
      <div className="mt-6 text-xs">
        {saving ? <span className="opacity-70">Salvando…</span> : error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
