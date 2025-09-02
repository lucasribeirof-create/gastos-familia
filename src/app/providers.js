// src/app/providers.jsx
"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"

export default function Providers({ children }) {
  // aplica tema salvo antes de renderizar o app
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme") || "light"
      document.documentElement.classList.toggle("dark", t === "dark")
    } catch {}
  }, [])

  return <SessionProvider>{children}</SessionProvider>
}
