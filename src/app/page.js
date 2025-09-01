"use client"
import { signIn, signOut, useSession } from "next-auth/react"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <main style={{display:"grid",placeItems:"center",height:"100vh"}}>Carregando…</main>
  }

  return (
    <main style={{display:"grid",placeItems:"center",height:"100vh",gap:16}}>
      <h1>Gastos Família</h1>

      {!session ? (
        <button onClick={() => signIn("google")} style={{padding:"12px 16px", borderRadius:8}}>
          Entrar com Google
        </button>
      ) : (
        <>
          <p>Olá, {session.user?.name}</p>
          <button onClick={() => signOut()} style={{padding:"12px 16px", borderRadius:8}}>
            Sair
          </button>
        </>
      )}
    </main>
  )
}
