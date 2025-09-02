// src/app/layout.js
import "./globals.css"
import Providers from "./providers"

export const metadata = {
  title: "Gastos em Família",
  description: "App para gerenciar gastos por projeto",
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
