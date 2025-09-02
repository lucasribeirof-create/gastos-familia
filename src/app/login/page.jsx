// src/app/login/page.jsx
"use client"

import { Suspense, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginInner() {
  const { status } = useSession()
  const router = useRouter()
  const search = useSearchParams()
  const callbackUrl = search?.get("callbackUrl") || "/dashboard"

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h1 className="text-xl font-semibold mb-2">Entrar</h1>
        <p className="text-sm opacity-70 mb-4">
          Acesse com sua conta Google para continuar.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          Entrar com Google
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6">Carregando…</div>}>
      <LoginInner />
    </Suspense>
  )
}
