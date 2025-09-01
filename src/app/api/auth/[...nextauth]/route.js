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
```

---

**2. Agora, vamos enviar essa correção para o GitHub.**

Vá para o seu **PowerShell** e use os três comandos de sempre.

**Prepare a correção:**
```bash
git add .
```

**Etiquete a correção:**
```bash
git commit -m "Simplifica configuração do NextAuth para corrigir erro 500"
```

**Envie a correção:**
```bash
git push

