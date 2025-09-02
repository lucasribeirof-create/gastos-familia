// src/app/page.js
"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard")
    else if (status === "unauthenticated") router.replace("/login?callbackUrl=/dashboard")
  }, [status, router])

  return <div className="p-6">Carregando…</div>
}
