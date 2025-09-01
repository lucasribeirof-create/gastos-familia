'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

// --- Ícones para usar na interface ---
const IconeX = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" className="inline-block" viewBox="0 0 16 16">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
);

// Este é o nosso app de gastos de verdade.
// Movemos ele para dentro de um componente separado.
function AppDeGastos({ usuario }) {
  // Todo o código de antes (useState, useEffect, cálculos) vai aqui dentro.
  // Por enquanto, vamos deixar um exemplo simples.
  return (
    <div>
      <header className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-gray-700">Gastos em Família</h1>
            <p className="text-sm text-gray-500">Logado como: {usuario.email}</p>
        </div>
        <button onClick={() => signOut()} className="text-sm bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
          Sair
        </button>
      </header>
      {/* O resto do nosso app (formulários, listas, etc) entrará aqui no próximo passo */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 text-center">
        <h2 className="text-2xl font-bold">Bem-vindo!</h2>
        <p className="mt-2">O sistema de login está funcionando. O próximo passo será conectar seus gastos a esta conta.</p>
      </div>
    </div>
  );
}

// Este é o componente principal da página.
// Ele decide se mostra a tela de login ou o app de gastos.
export default function PaginaPrincipal() {
  const { data: session, status } = useSession();

  // Enquanto o sistema verifica se você está logado, mostra uma mensagem.
  if (status === "loading") {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  // Se você estiver logado (sessão existe), mostra o app de gastos.
  if (session) {
    return (
      <div className="bg-gray-50 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <AppDeGastos usuario={session.user} />
        </div>
      </div>
    );
  }

  // Se você não estiver logado, mostra a tela de login.
  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center">
      <div className="text-center bg-white p-10 rounded-xl shadow-lg border">
        <h1 className="text-3xl font-bold text-gray-800">Bem-vindo ao Racha Contas</h1>
        <p className="text-gray-600 mt-2 mb-6">Faça login com sua conta do Google para continuar.</p>
        <button onClick={() => signIn('google')} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-3 mx-auto">
          <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.519-3.355-11.28-7.97l-6.522 5.023C9.507 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C44.272 34.113 48 27.459 48 20c0-1.341-.138-2.65-.389-3.917z"></path></svg>
          Entrar com o Google
        </button>
      </div>
    </div>
  );
}

