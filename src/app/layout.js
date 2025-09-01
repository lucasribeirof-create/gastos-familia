import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Racha Contas",
  description: "Divida os gastos com a família e amigos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

