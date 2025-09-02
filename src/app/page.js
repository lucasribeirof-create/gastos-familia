"use client"

export const dynamic = "force-dynamic"
export const revalidate = false
export const fetchCache = "force-no-store"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard")
  }, [router])
  return <div className="p-6">Abrindo o dashboard…</div>
}
