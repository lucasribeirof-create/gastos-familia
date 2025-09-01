"use client"
import { useSession, signIn, signOut } from "next-auth/react"

/**
 * Este componente é o seu "app" pós-login.
 * Está no MESMO arquivo para ficar simples: logou -> mostra o Dashboard.
 * Depois você pode separar para /dashboard se quiser.
 */
function Dashboard({ user }) {
  return (
    <main style={{display:"grid",placeItems:"center",height:"100vh",gap:24}}>
      <h1 style={{fontSize:32}}>Gastos Família — Dashboard</h1>

      <div style={{textAlign:"center"}}>
        <p style={{marginBottom:8}}>Bem-vindo, <strong>{user?.name || "usuário"}</strong></p>
        <p style={{opacity:0.7, fontSize:14}}>
          (Aqui vai a tela do seu app. Pode trocar esse conteúdo quando quiser.)
        </p>
      </div>

      <button
        onClick={() => signOut()}
        style={{padding:"12px 18px", borderRadius:10, border:"1px solid #999"}}
      >
        Sair
      </button>
    </main>
  )
}

export default function Home() {
  const { data: session, status } = useSession()

  // Enquanto checa a sessão
  if (status === "loading") {
    return (
      <main style={{display:"grid",placeItems:"center",height:"100vh"}}>
        Carregando…
      </main>
    )
  }

  // Se NÃO estiver logado: mostra só o botão de entrar
  if (status !== "authenticated") {
    return (
      <main style={{display:"grid",placeItems:"center",height:"100vh",gap:16}}>
        <h1 style={{fontSize:32}}>Gastos Família</h1>
        <button
          onClick={() => signIn("google")} // volta para esta mesma página já logado
          style={{padding:"12px 18px", borderRadius:10, border:"1px solid #999"}}
        >
          Entrar com Google
        </button>
      </main>
    )
  }

  // Se estiver logado: mostra o "app"
  return <Dashboard user={session.user} />
}
