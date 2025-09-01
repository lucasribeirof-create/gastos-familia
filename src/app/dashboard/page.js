"use client"
import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const { status, data: session } = useSession()
  const router = useRouter()

  // Se não estiver logado, manda de volta para a home
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/")
  }, [status, router])

  if (status !== "authenticated") return <main>Carregando…</main>

  return (
    <main style={{display:"grid",placeItems:"center",height:"100vh",gap:16}}>
      <h1>Dashboard</h1>
      <p>Bem-vindo, {session.user?.name}</p>
      <button onClick={() => signOut()} style={{padding:"12px 16px",borderRadius:8}}>
        Sair
      </button>
    </main>
  )
}
