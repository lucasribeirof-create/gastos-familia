"use client"
import { signIn, useSession } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard")
  }, [status, router])

  return (
    <main style={{display:"grid",placeItems:"center",height:"100vh",gap:16}}>
      <h1 style={{fontSize:32}}>Gastos Família</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        style={{padding:"12px 18px", borderRadius:10, border:"1px solid #999"}}
      >
        Entrar com Google
      </button>
    </main>
  )
}
