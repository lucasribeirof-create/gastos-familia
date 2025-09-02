
import "./globals.css"

export const metadata = {
  title: "Gastos em Família",
  description: "Gerencie despesas por projeto com sua família.",
}

export default function RootLayout({ children }) {
  // Script mínimo para respeitar tema salvo antes do paint
  const themeScript = `
  (function(){
    try {
      var t = localStorage.getItem("theme");
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var useDark = (t ? t === "dark" : prefersDark);
      if (useDark) document.documentElement.classList.add("dark");
    } catch(e){}
  })();
  `

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
