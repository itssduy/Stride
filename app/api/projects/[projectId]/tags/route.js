import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex, e.g. #3B82F6"),
});

async function ensureMembership(projectId, userId) {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return Boolean(membership);
}

export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = params;
  const allowed = await ensureMembership(projectId, session.user.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tags = await prisma.tag.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = params;
  const allowed = await ensureMembership(projectId, session.user.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const tag = await prisma.tag.create({
      data: {
        projectId,
        name: parsed.data.name.trim(),
        color: parsed.data.color,
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Tag name already exists in this project" }, { status: 409 });
  }
}
