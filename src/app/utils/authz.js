export function roleForEmail(project, email) {
  const em = String(email || "").toLowerCase();
  const members = Array.isArray(project?.members) ? project.members : [];
  const m = members.find((x) => String(x?.email || "").toLowerCase() === em);
  if (m?.role) return m.role;
  return "none";
}

export function assertCanManageMembers(project, email) {
  const role = roleForEmail(project, email);
  if (role !== "owner") {
    const err = new Error("Proibido - Apenas o dono pode gerenciar membros");
    err.status = 403;
    throw err;
  }
}

export function assertCanEditProject(project, email) {
  const role = roleForEmail(project, email);
  if (!(role === "owner" || role === "editor")) {
    const err = new Error("Proibido - Sem permissão de edição");
    err.status = 403;
    throw err;
  }
}

export function assertCanViewProject(project, email) {
  const role = roleForEmail(project, email);
  if (role === "none") {
    const err = new Error("Proibido - Sem permissão para visualizar");
    err.status = 403;
    throw err;
  }
}
