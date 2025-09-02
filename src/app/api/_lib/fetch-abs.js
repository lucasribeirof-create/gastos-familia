// src/app/api/_lib/fetch-abs.js
// Patch para permitir fetch('/api/...') no ambiente server (Node/Vercel)
// Convertendo automaticamente para URL absoluta com base no domínio do app.

if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
  const originalFetch = globalThis.fetch;

  function resolveBase() {
    // 1) Se você definir NEXT_PUBLIC_SITE_URL no Vercel (recomendado)
    //    ex.: https://gastos-familia.vercel.app
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    // 2) VERCEL_URL vem sem protocolo; precisamos prefixar
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    // 3) fallback local
    return "http://localhost:3000";
  }

  globalThis.fetch = async function (input, init) {
    try {
      if (typeof input === "string") {
        // se começar com "/" tratamos como relativo
        if (input.startsWith("/")) {
          const abs = new URL(input, resolveBase()).toString();
          return originalFetch(abs, init);
        }
      } else if (input && typeof input.url === "string") {
        // Request object com url relativa (raro)
        if (input.url.startsWith("/")) {
          const abs = new URL(input.url, resolveBase()).toString();
          const copy = new Request(abs, input);
          return originalFetch(copy, init);
        }
      }
    } catch (e) {
      // Deixa cair no fetch original para não mascarar nada que não seja relativo
      // (mas na prática só entra aqui se der erro no new URL).
    }
    return originalFetch(input, init);
  };
}
