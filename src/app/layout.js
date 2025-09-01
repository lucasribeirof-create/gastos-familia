import "./globals.css";
import Providers from "./providers"; // Importando nosso novo arquivo de ajuda

export const metadata = {
  title: "Racha Contas",
  description: "Divida os gastos com a família e amigos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        {/* Envelopando nosso app com o "Provedor" */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

