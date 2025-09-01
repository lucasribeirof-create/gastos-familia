import "./globals.css"
import Providers from "./providers"

// 🔧 Diz ao Next: não tente pré-renderizar; renderize sempre em tempo real
export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = {
  title: "Gastos Família",
  description: "App de gastos com login Google",
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
