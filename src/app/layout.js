// src/app/layout.js
import "./globals.css"

export const metadata = {
  title: "Gastos em Família",
  description: "Gerencie despesas em família por projeto.",
}

export default function RootLayout({ children }) {
  // Script que roda antes da hidratação para setar o tema
  const themeInit = `
    (function(){
      try {
        var saved = localStorage.getItem("theme");
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var dark = (saved ? saved === "dark" : prefersDark);
        var root = document.documentElement;
        if (dark) root.classList.add("dark"); else root.classList.remove("dark");
      } catch(e) {}
    })();
  `.replace(/\s+/g, " ");

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  )
}
