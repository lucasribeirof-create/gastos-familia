// /src/utils/authz.js
export function roleOf(userEmail, project) {
  if (!userEmail || !project) return "viewer"
  if (project.owner === userEmail) return "owner"
  const m = (project.members || []).find(x => x.email === userEmail)
  return m?.role || "viewer"
}

export function canManageMembers(userEmail, project) {
  return roleOf(userEmail, project) === "owner"
}

// "editor" pode editar despesas/categorias e propriedades básicas do projeto (exceto owner/members)
export function canEditProject(userEmail, project) {
  const r = roleOf(userEmail, project)
  return r === "owner" || r === "editor"
}

// "viewer" pode ver
export function canViewProject(userEmail, project) {
  return !!roleOf(userEmail, project)
}
