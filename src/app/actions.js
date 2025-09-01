// src/app/actions.js

// Cliente simples para a API de família (mesmo domínio)
export async function carregarFamilia(slug) {
  const res = await fetch(`/api/family/${encodeURIComponent(slug)}`, {
    method: "GET",
    cache: "no-store",
  })
  if (!res.ok) {
    const msg = await safeText(res)
    throw new Error(msg || "Erro ao carregar dados")
  }
  return res.json()
}

export async function salvarFamilia(slug, dados) {
  const res = await fetch(`/api/family/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  })
  if (!res.ok) {
    const msg = await safeText(res)
    throw new Error(msg || "Erro ao salvar dados")
  }
  return res.json()
}

async function safeText(res) {
  try { return await res.text() } catch { return "" }
}
