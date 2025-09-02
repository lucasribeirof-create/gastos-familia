import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadFamily, saveFamily } from "@/utils/db";
import { assertCanEditProject, assertCanViewProject } from "@/utils/authz";

export const dynamic = "force-dynamic";

function defaultDoc(ownerEmail) {
  return {
    people: [],
    categories: ["Mercado", "Carro", "Aluguel", "Lazer"],
    projects: [
      {
        id: "proj-" + Math.random().toString(36).slice(2, 8),
        name: "Geral",
        type: "monthly",
        start: new Date().toISOString().slice(0, 10),
        end: "",
        status: "open",
        members: ownerEmail ? [{ email: ownerEmail.toLowerCase(), role: "owner" }] : [],
      },
    ],
    expenses: [],
    updatedAt: new Date().toISOString(),
  };
}

function getActiveProject(doc, projectId) {
  const project = (doc.projects || []).find((p) => p.id === projectId);
  if (!project) {
    const err = new Error("Projeto não encontrado");
    err.status = 404;
    throw err;
  }
  return project;
}

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.toLowerCase();

    if (!userEmail) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { slug } = params;
    let doc = await loadFamily(slug);

    if (!doc) {
      doc = defaultDoc(userEmail);
      await saveFamily(slug, doc);
    }
    
    // AQUI: verifica se o usuário pode ver o projeto antes de retornar.
    const projectIds = new Set(doc.projects.map(p => p.id));
    const activeProjectId = projectIds.has(params.projectId) ? params.projectId : doc.projects[0]?.id;
    
    if (activeProjectId) {
      const activeProject = getActiveProject(doc, activeProjectId);
      assertCanViewProject(activeProject, userEmail);
    } else {
      // Se não há projetos, permite o acesso para que o usuário possa criar um
    }
    
    return Response.json(doc);
  } catch (e) {
    const status = e.status || 500;
    return Response.json({ error: e.message || "Falha ao carregar família" }, { status });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.toLowerCase();

    if (!userEmail) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { slug } = params;
    const body = await req.json();

    const doc = {
      people: Array.isArray(body.people) ? body.people : [],
      categories: Array.isArray(body.categories) ? body.categories : [],
      projects: Array.isArray(body.projects) ? body.projects : [],
      expenses: Array.isArray(body.expenses) ? body.expenses : [],
      updatedAt: new Date().toISOString(),
    };

    // AQUI: valida a permissão no projeto ativo que está sendo alterado.
    // O body.activeProjectId deve vir do cliente.
    const activeProject = (doc.projects || []).find(p => p.id === body.activeProjectId);

    if (activeProject) {
      assertCanEditProject(activeProject, userEmail);
    } else {
      // Se não houver projeto ativo ou for o primeiro save, a validação é menos rigorosa
      const canEditAny = doc.projects.some(p => {
        try { assertCanEditProject(p, userEmail); return true; } catch { return false; }
      });
      if (!canEditAny) {
        return Response.json({ error: "Proibido - Sem permissão de edição" }, { status: 403 });
      }
    }

    await saveFamily(slug, doc);
    return Response.json({ ok: true });
  } catch (e) {
    const status = e.status || 500;
    return Response.json({ error: e.message || "Falha ao salvar" }, { status });
  }
}
