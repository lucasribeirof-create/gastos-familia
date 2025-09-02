import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { loadFamily, saveFamily } from "@/utils/db";
import { assertCanManageMembers } from "@/utils/authz";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.toLowerCase();
    if (!userEmail) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { slug, projectId } = params;
    const { email: invitedEmail, role } = await req.json();

    const doc = await loadFamily(slug);
    if (!doc) {
      return Response.json({ error: "Família não encontrada" }, { status: 404 });
    }

    const project = (doc.projects || []).find(p => p.id === projectId);
    if (!project) {
      return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
    }

    assertCanManageMembers(project, userEmail);

    const members = Array.isArray(project.members) ? project.members : [];
    const memberExists = members.some(m => m.email.toLowerCase() === invitedEmail.toLowerCase());

    if (!memberExists) {
      project.members.push({ email: invitedEmail.toLowerCase(), role });
      await saveFamily(slug, doc);
    }

    return Response.json({ ok: true });
  } catch (e) {
    const status = e.status || 500;
    return Response.json({ error: e.message || "Falha ao adicionar membro" }, { status });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.toLowerCase();
    if (!userEmail) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { slug, projectId } = params;
    const { email: memberEmail } = await _req.json();

    const doc = await loadFamily(slug);
    if (!doc) {
      return Response.json({ error: "Família não encontrada" }, { status: 404 });
    }

    const project = (doc.projects || []).find(p => p.id === projectId);
    if (!project) {
      return Response.json({ error: "Projeto não encontrado" }, { status: 404 });
    }

    assertCanManageMembers(project, userEmail);

    project.members = (project.members || []).filter(m => m.email.toLowerCase() !== memberEmail.toLowerCase());
    await saveFamily(slug, doc);

    return Response.json({ ok: true });
  } catch (e) {
    const status = e.status || 500;
    return Response.json({ error: e.message || "Falha ao remover membro" }, { status });
  }
}
