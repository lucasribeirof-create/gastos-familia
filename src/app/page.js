'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

// --- Ícones para usar na interface ---
const IconeX = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" className="inline-block" viewBox="0 0 16 16">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
);

// ==========================================================================================
// NOSSO APP DE GASTOS COMPLETO
// Ele agora vive aqui, como um componente que só aparece quando o usuário está logado.
// ==========================================================================================
function AppDeGastos({ usuario }) {
  // Estados (a "memória" do nosso app)
  const [pessoas, setPessoas] = useState([]);
  const [nomePessoa, setNomePessoa] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [gastos, setGastos] = useState([]);
  const [gastoDescricao, setGastoDescricao] = useState('');
  const [gastoValor, setGastoValor] = useState('');
  const [gastoQuemPagou, setGastoQuemPagou] = useState('');
  const [gastoCategoria, setGastoCategoria] = useState('');
  const [gastoData, setGastoData] = useState(new Date().toISOString().split('T')[0]);
  const [appPronto, setAppPronto] = useState(false);

  // EFEITO: Carregar dados do localStorage (vamos conectar ao banco de dados depois)
  useEffect(() => {
    const pessoasSalvas = localStorage.getItem('racha-contas-pessoas');
    if (pessoasSalvas) setPessoas(JSON.parse(pessoasSalvas)); else setPessoas([usuario.name || 'Eu']);
    const categoriasSalvas = localStorage.getItem('racha-contas-categorias');
    if (categoriasSalvas) setCategorias(JSON.parse(categoriasSalvas)); else setCategorias(['Mercado', 'Lazer', 'Casa']);
    const gastosSalvos = localStorage.getItem('racha-contas-gastos');
    if (gastosSalvos) setGastos(JSON.parse(gastosSalvos));
    setAppPronto(true);
  }, [usuario.name]);

  useEffect(() => { if(appPronto) localStorage.setItem('racha-contas-pessoas', JSON.stringify(pessoas)); }, [pessoas, appPronto]);
  useEffect(() => { if(appPronto) localStorage.setItem('racha-contas-categorias', JSON.stringify(categorias)); }, [categorias, appPronto]);
  useEffect(() => { if(appPronto) localStorage.setItem('racha-contas-gastos', JSON.stringify(gastos)); }, [gastos, appPronto]);

  // Funções para manipular os estados
  const adicionarPessoa = (e) => { e.preventDefault(); if (nomePessoa.trim() && !pessoas.includes(nomePessoa.trim())) { setPessoas([...pessoas, nomePessoa.trim()]); setNomePessoa(''); } };
  const removerPessoa = (nome) => setPessoas(pessoas.filter(p => p !== nome));
  const adicionarCategoria = (e) => { e.preventDefault(); if (novaCategoria.trim() && !categorias.includes(novaCategoria.trim())) { setCategorias([...categorias, novaCategoria.trim()]); setNovaCategoria(''); } };
  const removerCategoria = (nome) => setCategorias(categorias.filter(c => c !== nome));
  const adicionarGasto = (e) => { e.preventDefault(); if (gastoDescricao && gastoValor > 0 && gastoQuemPagou && gastoCategoria) { const novoGasto = { id: Date.now(), descricao: gastoDescricao, valor: parseFloat(gastoValor), quemPagou: gastoQuemPagou, categoria: gastoCategoria, data: gastoData }; setGastos([...gastos, novoGasto].sort((a,b) => new Date(b.data) - new Date(a.data))); setGastoDescricao(''); setGastoValor(''); }};
  const removerGasto = (id) => setGastos(gastos.filter(g => g.id !== id));
  const limparTudo = () => { if(window.confirm('Tem certeza que deseja apagar todos os dados deste navegador?')) { localStorage.removeItem('racha-contas-pessoas'); localStorage.removeItem('racha-contas-categorias'); localStorage.removeItem('racha-contas-gastos'); setPessoas([usuario.name || 'Eu']); setCategorias(['Mercado', 'Lazer', 'Casa']); setGastos([]); }};
  const formatarData = (data) => new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');

  // Cálculos
  const gastosPorCategoria = useMemo(() => { const g = gastos.reduce((acc, gasto) => { if (!acc[gasto.categoria]) acc[gasto.categoria] = []; acc[gasto.categoria].push(gasto); return acc; }, {}); return Object.keys(g).map(cat => ({ nome: cat, gastos: g[cat], total: g[cat].reduce((s, item) => s + item.valor, 0) })).sort((a,b) => b.total - a.total); }, [gastos]);
  const resultadoDivisao = useMemo(() => { const total = gastos.reduce((s, g) => s + g.valor, 0); if (pessoas.length === 0 || total === 0) return { total: 0, porPessoa: 0, saldos: {}, transacoes: [] }; const porPessoa = total / pessoas.length; const saldos = pessoas.reduce((acc, p) => { acc[p] = gastos.filter(g => g.quemPagou === p).reduce((s, g) => s + g.valor, 0) - porPessoa; return acc; }, {}); const devedores = Object.entries(saldos).filter(([,v]) => v < 0).sort((a,b) => a[1] - b[1]); const credores = Object.entries(saldos).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]); const transacoes = []; let i=0, j=0; while(i < devedores.length && j < credores.length) { const [devedorNome, dividaAbs] = [devedores[i][0], -devedores[i][1]]; const [credorNome, credito] = [credores[j][0], credores[j][1]]; const valor = Math.min(dividaAbs, credito); if (valor > 0.01) transacoes.push({ de: devedorNome, para: credorNome, valor }); devedores[i][1] += valor; credores[j][1] -= valor; if (Math.abs(devedores[i][1]) < 0.01) i++; if (Math.abs(credores[j][1]) < 0.01) j++; } return { total, porPessoa, saldos, transacoes }; }, [gastos, pessoas]);

  if (!appPronto) return <div className="text-center p-10">Carregando dados...</div>;

  return (
    <>
      <header className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-700">Gastos em Família</h1>
          <p className="text-sm text-gray-500">Logado como: {usuario.email}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <button onClick={() => signOut()} className="text-sm bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
            Sair
            </button>
            <button onClick={limparTudo} className="text-xs bg-red-500 text-white font-semibold py-1 px-3 rounded-lg hover:bg-red-600 transition-colors">
            Limpar tudo
            </button>
        </div>
      </header>
      <main className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border"><h2 className="text-lg font-semibold mb-3">1) Pessoas do grupo</h2><form onSubmit={adicionarPessoa} className="flex gap-2"><input type="text" value={nomePessoa} onChange={e => setNomePessoa(e.target.value)} placeholder="Nome" className="flex-grow p-2 border rounded-lg"/><button type="submit" className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg">Adicionar</button></form><div className="flex flex-wrap gap-2 mt-3">{pessoas.map(p => (<span key={p} className="bg-gray-200 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">{p}<button onClick={() => removerPessoa(p)} className="text-gray-500"><IconeX /></button></span>))}</div></div>
            <div className="bg-white p-5 rounded-xl shadow-sm border"><h2 className="text-lg font-semibold mb-3">2) Categorias</h2><form onSubmit={adicionarCategoria} className="flex gap-2"><input type="text" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Nova categoria" className="flex-grow p-2 border rounded-lg"/><button type="submit" className="bg-green-600 text-white font-semibold px-5 py-2 rounded-lg">Adicionar</button></form><div className="flex flex-wrap gap-2 mt-3">{categorias.map(c => (<span key={c} className="bg-gray-200 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">{c}<button onClick={() => removerCategoria(c)} className="text-gray-500"><IconeX /></button></span>))}</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border"><h2 className="text-lg font-semibold mb-3">3) Adicionar despesa</h2><form onSubmit={adicionarGasto} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 items-end"><div className="sm:col-span-1 md:col-span-2"><label className="text-sm font-medium">Quem pagou</label><select value={gastoQuemPagou} onChange={e => setGastoQuemPagou(e.target.value)} required className="w-full mt-1 p-2 border rounded-lg"><option value="">Selecione</option>{pessoas.map(p => <option key={p} value={p}>{p}</option>)}</select></div><div className="sm:col-span-1 md:col-span-2"><label className="text-sm font-medium">Categoria</label><select value={gastoCategoria} onChange={e => setGastoCategoria(e.target.value)} required className="w-full mt-1 p-2 border rounded-lg"><option value="">Selecione</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="sm:col-span-1 md:col-span-1"><label className="text-sm font-medium">Valor (R$)</label><input type="number" step="0.01" value={gastoValor} onChange={e => setGastoValor(e.target.value)} required placeholder="0,00" className="w-full mt-1 p-2 border rounded-lg"/></div><div className="sm:col-span-1 md:col-span-3"><label className="text-sm font-medium">Descrição</label><input type="text" value={gastoDescricao} onChange={e => setGastoDescricao(e.target.value)} required className="w-full mt-1 p-2 border rounded-lg"/></div><div className="sm:col-span-1 md:col-span-2"><label className="text-sm font-medium">Data</label><input type="date" value={gastoData} onChange={e => setGastoData(e.target.value)} required className="w-full mt-1 p-2 border rounded-lg"/></div><div className="sm:col-span-1 md:col-span-2"><button type="submit" className="w-full bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700">Lançar</button></div></form></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border"><h2 className="text-lg font-semibold mb-3">Despesas</h2>{gastos.length === 0 ? (<p className="text-gray-500 text-center py-4">Nenhuma despesa lançada.</p>) : (<div className="space-y-4">{gastosPorCategoria.map(({ nome, gastos: gastosDaCategoria, total }) => (<div key={nome}><div className="flex justify-between items-baseline border-b-2 pb-1 mb-2"><h3 className="font-bold">{nome}</h3><span className="text-sm font-semibold">Total: R$ {total.toFixed(2)}</span></div><ul className="space-y-3 pl-2">{gastosDaCategoria.map(g => (<li key={g.id} className="flex items-center justify-between"><div><p className="font-semibold">{g.descricao}</p><p className="text-sm text-gray-500">{g.quemPagou} &bull; {formatarData(g.data)}</p></div><div className="flex items-center gap-4"><span className="font-bold">R$ {g.valor.toFixed(2)}</span><button onClick={() => removerGasto(g.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">remover</button></div></li>))}</ul></div>))}</div>)}</div>
              <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border space-y-4"><h2 className="text-lg font-semibold">Resumo</h2><div className="text-center bg-gray-100 p-3 rounded-lg"><p className="text-gray-600">Total</p><p className="text-2xl font-bold">R$ {resultadoDivisao.total.toFixed(2)}</p>{pessoas.length > 0 && <p className="text-sm text-gray-500">Por pessoa ({pessoas.length}): R$ {resultadoDivisao.porPessoa.toFixed(2)}</p>}</div><div><h3 className="font-semibold mb-2">Quem pagou quanto</h3><ul className="space-y-1 text-sm">{pessoas.map(p => { const pago = gastos.filter(g => g.quemPagou === p).reduce((s, g) => s + g.valor, 0); const saldo = resultadoDivisao.saldos[p] || 0; return ( <li key={p} className="flex justify-between"><span>{p}</span><span className="font-mono">R$ {pago.toFixed(2)}<span className={`ml-2 font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>({saldo >= 0 ? '+' : ''}R$ {saldo.toFixed(2)})</span></span></li> ) })}</ul></div><div><h3 className="font-semibold mb-2">Acertos</h3>{resultadoDivisao.transacoes.length === 0 ? (<p className="text-sm text-gray-500 text-center">Nenhum acerto.</p>) : (<ul className="space-y-2">{resultadoDivisao.transacoes.map((t, i) => (<li key={i} className="bg-green-100 text-green-800 text-center text-sm font-semibold p-2 rounded-lg">{t.de} deve para {t.para} <span className="font-bold">R$ {t.valor.toFixed(2)}</span></li>))}</ul>)}</div></div>
          </div>
      </main>
    </>
  );
}


// ==========================================================================================
// COMPONENTE PRINCIPAL DA PÁGINA
// Ele decide se mostra a tela de login ou o app de gastos.
// ==========================================================================================
export default function PaginaDeLogin() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <main className="bg-gray-50 min-h-screen flex items-center justify-center"><p>Carregando...</p></main>
  }

  if (session) {
    return (
      <div className="bg-gray-50 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
            <AppDeGastos usuario={session.user} />
        </div>
      </div>
    )
  }

  return (
    <main className="bg-gray-50 min-h-screen flex items-center justify-center">
      <div className="text-center bg-white p-10 rounded-xl shadow-lg border">
        <h1 className="text-3xl font-bold text-gray-800">Bem-vindo ao Racha Contas</h1>
        <p className="text-gray-600 mt-2 mb-6">Faça login com sua conta do Google para continuar.</p>
        <button onClick={() => signIn("google")} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-3 mx-auto">
            <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.519-3.355-11.28-7.97l-6.522 5.023C9.507 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C44.272 34.113 48 27.459 48 20c0-1.341-.138-2.65-.389-3.917z"></path></svg>
            Entrar com o Google
        </button>
      </div>
    </main>
  )
}