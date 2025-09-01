import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

// Esta é a configuração do nosso "segurança".
// Ele sabe como usar as chaves que guardamos na Vercel.
const handler = NextAuth({
  providers: [
    GoogleProvider({
      // process.env é como ele lê as chaves do "cofre" da Vercel.
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
})

// Exportamos o "segurança" para que o Next.js possa usá-lo.
export { handler as GET, handler as POST }

