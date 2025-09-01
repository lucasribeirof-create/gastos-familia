'use client';

import { useState, useMemo } from 'react';

// --- Ícones para usar na interface ---
const IconeLixeira = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" className="inline-block">
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
  </svg>
);
const IconeX = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" className="inline-block" viewBox="0 0 16 16">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
);


export default function RachaContasApp() {
  // --- Estados (a "memória" do nosso app) ---
  const [pessoas, setPessoas] = useState(['Lucas', 'Katy', 'Clara']);
  const [nomePessoa, setNomePessoa] = useState('');

  const [categorias, setCategorias] = useState(['Mercado', 'Carro', 'Aluguel', 'Lazer']);
  const [novaCategoria, setNovaCategoria] = useState('');

  const [gastos, setGastos] = useState([]);
  const [gastoDescricao, setGastoDescricao] = useState('');
  const [gastoValor, setGastoValor] = useState('');
  const [gastoQuemPagou, setGastoQuemPagou] = useState('');
  const [gastoCategoria, setGastoCategoria] = useState('');
  const [gastoData, setGastoData] = useState(new Date().toISOString().split('T')[0]); // Data de hoje

  // --- Funções para manipular os estados ---

  const adicionarPessoa = (e) => {
    e.preventDefault();
    if (nomePessoa.trim() && !pessoas.includes(nomePessoa.trim())) {
      setPessoas([...pessoas, nomePessoa.trim()]);
      setNomePessoa('');
    }
  };
  const removerPessoa = (nomeParaRemover) => setPessoas(pessoas.filter(p => p !== nomeParaRemover));
  
  const adicionarCategoria = (e) => {
    e.preventDefault();
    if (novaCategoria.trim() && !categorias.includes(novaCategoria.trim())) {
      setCategorias([...categorias, novaCategoria.trim()]);
      setNovaCategoria('');
    }
  };

  const removerCategoria = (catParaRemover) => {
    setCategorias(categorias.filter(c => c !== catParaRemover));
  };
  
  const adicionarGasto = (e) => {
    e.preventDefault();
    if (gastoDescricao && gastoValor > 0 && gastoQuemPagou && gastoCategoria && gastoData) {
      const novoGasto = {
        id: Date.now(),
        descricao: gastoDescricao.trim(),
        valor: parseFloat(gastoValor),
        quemPagou: gastoQuemPagou,
        categoria: gastoCategoria,
        data: gastoData,
      };
      setGastos([...gastos, novoGasto].sort((a, b) => new Date(b.data) - new Date(a.data)));
      setGastoDescricao('');
      setGastoValor('');
    }
  };

  const removerGasto = (idParaRemover) => setGastos(gastos.filter(g => g.id !== idParaRemover));

  const limparTudo = () => {
      setPessoas([]);
      setCategorias([]);
      setGastos([]);
  };

  const formatarData = (dataString) => {
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  // --- NOVO: Agrupamento de gastos por categoria ---
  const gastosPorCategoria = useMemo(() => {
    // 1. Agrupa os gastos em um objeto: { Mercado: [...], Carro: [...] }
    const grouped = gastos.reduce((acc, gasto) => {
      const categoria = gasto.categoria;
      if (!acc[categoria]) {
        acc[categoria] = [];
      }
      acc[categoria].push(gasto);
      return acc;
    }, {});

    // 2. Transforma o objeto em um array, calcula o total e ordena
    return Object.keys(grouped)
      .map(categoria => ({
        nome: categoria,
        gastos: grouped[categoria],
        total: grouped[categoria].reduce((soma, gasto) => soma + gasto.valor, 0),
      }))
      .sort((a, b) => b.total - a.total); // Ordena do maior para o menor gasto
  }, [gastos]);


  // --- A MÁGICA: Cálculo da divisão ---
  const resultadoDivisao = useMemo(() => {
    const total = gastos.reduce((acc, gasto) => acc + gasto.valor, 0);
    if (pessoas.length === 0 || total === 0) {
      return { total: 0, porPessoa: 0, saldos: {}, transacoes: [] };
    }

    const porPessoa = total / pessoas.length;
    
    const saldos = pessoas.reduce((acc, pessoa) => {
      const pagamentos = gastos.filter(g => g.quemPagou === pessoa).reduce((soma, g) => soma + g.valor, 0);
      acc[pessoa] = pagamentos - porPessoa;
      return acc;
    }, {});

    const devedores = Object.entries(saldos).filter(([, valor]) => valor < 0).sort((a, b) => a[1] - b[1]);
    const credores = Object.entries(saldos).filter(([, valor]) => valor > 0).sort((a, b) => b[1] - a[1]);
    
    const transacoes = [];
    let i = 0, j = 0;
    while(i < devedores.length && j < credores.length) {
      const devedorNome = devedores[i][0];
      let divida = -devedores[i][1];
      const credorNome = credores[j][0];
      let credito = credores[j][1];

      const valorTransferencia = Math.min(divida, credito);
      
      if (valorTransferencia > 0.01) {
          transacoes.push({ de: devedorNome, para: credorNome, valor: valorTransferencia });
      }

      devedores[i][1] += valorTransferencia;
      credores[j][1] -= valorTransferencia;

      if (Math.abs(devedores[i][1]) < 0.01) i++;
      if (Math.abs(credores[j][1]) < 0.01) j++;
    }

    return { total, porPessoa, saldos, transacoes };
  }, [gastos, pessoas]);

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-700">Gastos em Família</h1>
          <button onClick={limparTudo} className="text-sm bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors">
            Limpar tudo
          </button>
        </header>

        <main className="space-y-6">
          {/* --- SEÇÃO DE CONFIGURAÇÃO --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1) Pessoas */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-3">1) Pessoas do grupo</h2>
              <form onSubmit={adicionarPessoa} className="flex gap-2">
                <input type="text" value={nomePessoa} onChange={e => setNomePessoa(e.target.value)} placeholder="Nome (ex: Ana)" className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
                <button type="submit" className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors">Adicionar</button>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                {pessoas.map(p => (
                  <span key={p} className="bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">
                    {p}
                    <button onClick={() => removerPessoa(p)} className="text-gray-500 hover:text-gray-800"><IconeX /></button>
                  </span>
                ))}
              </div>
            </div>
            {/* 2) Categorias */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-3">2) Categorias</h2>
              <form onSubmit={adicionarCategoria} className="flex gap-2">
                <input type="text" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} placeholder="Nova categoria (ex: Remédios)" className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"/>
                <button type="submit" className="bg-green-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition-colors">Adicionar</button>
              </form>
              <div className="flex flex-wrap gap-2 mt-3">
                 {categorias.map(c => (
                  <span key={c} className="bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">
                    {c}
                    <button onClick={() => removerCategoria(c)} className="text-gray-500 hover:text-gray-800"><IconeX /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* --- 3) ADICIONAR DESPESA --- */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">3) Adicionar despesa</h2>
            <form onSubmit={adicionarGasto} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-600">Quem pagou</label>
                <select value={gastoQuemPagou} onChange={e => setGastoQuemPagou(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Selecione</option>
                  {pessoas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-600">Categoria</label>
                <select value={gastoCategoria} onChange={e => setGastoCategoria(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Selecione</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-1 md:col-span-1">
                <label className="text-sm font-medium text-gray-600">Valor (R$)</label>
                <input type="number" step="0.01" value={gastoValor} onChange={e => setGastoValor(e.target.value)} required placeholder="0,00" className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
              </div>
              <div className="sm:col-span-1 md:col-span-3">
                <label className="text-sm font-medium text-gray-600">Descrição</label>
                <input type="text" value={gastoDescricao} onChange={e => setGastoDescricao(e.target.value)} required placeholder="Ex: Feira do mês" className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
              </div>
              <div className="sm:col-span-1 md:col-span-2">
                 <label className="text-sm font-medium text-gray-600">Data</label>
                 <input type="date" value={gastoData} onChange={e => setGastoData(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
              </div>
              <div className="sm:col-span-1 md:col-span-2">
                <button type="submit" className="w-full bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Lançar</button>
              </div>
            </form>
          </div>

          {/* --- SEÇÃO DE RESULTADOS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Despesas (MODIFICADO) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-3">Despesas</h2>
              {gastos.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma despesa lançada ainda.</p>
              ) : (
                <div className="space-y-4">
                  {gastosPorCategoria.map(({ nome, gastos: gastosDaCategoria, total }) => (
                    <div key={nome}>
                      <div className="flex justify-between items-baseline border-b-2 border-gray-200 pb-1 mb-2">
                        <h3 className="font-bold text-md text-gray-700">{nome}</h3>
                        <span className="text-sm font-semibold text-gray-600">Total: R$ {total.toFixed(2)}</span>
                      </div>
                      <ul className="space-y-3 pl-2">
                        {gastosDaCategoria.map(g => (
                          <li key={g.id} className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{g.descricao}</p>
                              <p className="text-sm text-gray-500">{g.quemPagou} &bull; {formatarData(g.data)}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-md">R$ {g.valor.toFixed(2)}</span>
                              <button onClick={() => removerGasto(g.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold">remover</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Resumo */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <h2 className="text-lg font-semibold">Resumo</h2>
              <div className="text-center bg-gray-100 p-3 rounded-lg">
                <p className="text-gray-600">Total</p>
                <p className="text-2xl font-bold">R$ {resultadoDivisao.total.toFixed(2)}</p>
                {pessoas.length > 0 && <p className="text-sm text-gray-500">Por pessoa ( {pessoas.length} ): R$ {resultadoDivisao.porPessoa.toFixed(2)}</p>}
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Quem pagou quanto</h3>
                <ul className="space-y-1 text-sm">
                  {pessoas.map(p => {
                    const pago = gastos.filter(g => g.quemPagou === p).reduce((soma, g) => soma + g.valor, 0);
                    const saldo = resultadoDivisao.saldos[p] || 0;
                    return (
                      <li key={p} className="flex justify-between">
                        <span>{p}</span>
                        <span className="font-mono">
                          R$ {pago.toFixed(2)}
                          <span className={`ml-2 font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({saldo >= 0 ? '+' : ''}R$ {saldo.toFixed(2)})
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Acertos</h3>
                {resultadoDivisao.transacoes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center">Nenhum acerto necessário.</p>
                ) : (
                  <ul className="space-y-2">
                    {resultadoDivisao.transacoes.map((t, i) => (
                      <li key={i} className="bg-green-100 text-green-800 text-center text-sm font-semibold p-2 rounded-lg">
                        {t.de} deve para {t.para} <span className="font-bold">R$ {t.valor.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

        </main>
        
        <footer className="text-center mt-8 text-sm text-gray-500">
            <p>Dica: clique em "Limpar tudo" para começar um novo mês. Os dados ficam só neste navegador.</p>
        </footer>

      </div>
    </div>
  );
}

