import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

// A nova versão do Auth.js é mais inteligente.
// Ela encontra o AUTH_SECRET sozinha, então não precisamos mais declará-lo aqui.
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
})

export { handler as GET, handler as POST }