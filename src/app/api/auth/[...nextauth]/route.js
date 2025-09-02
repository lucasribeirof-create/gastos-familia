// src/app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // No Google Cloud Console, cadastre o redirect exato:
      // https://gastos-familia.vercel.app/api/auth/callback/google
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      if (session?.user) session.user.id = token.sub
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
