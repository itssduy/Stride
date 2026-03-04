import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  assigneeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional().default([]),
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

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true },
      },
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = params;
  const allowed = await ensureMembership(projectId, session.user.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const assigneeId = parsed.data.assigneeId || null;
  if (assigneeId) {
    const assigneeMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: assigneeId, projectId } },
    });
    if (!assigneeMember) return NextResponse.json({ error: "Assignee must be a project member" }, { status: 400 });
  }

  const tagIds = parsed.data.tagIds || [];
  if (tagIds.length) {
    const validTags = await prisma.tag.findMany({
      where: {
        projectId,
        id: { in: tagIds },
      },
      select: { id: true },
    });
    if (validTags.length !== tagIds.length) {
      return NextResponse.json({ error: "Some tags are invalid for this project" }, { status: 400 });
    }
  }

  const startDate = parsed.data.startDate ? new Date(`${parsed.data.startDate}T00:00:00.000Z`) : null;
  const endDate = parsed.data.endDate ? new Date(`${parsed.data.endDate}T00:00:00.000Z`) : null;
  if (startDate && endDate && endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assigneeId,
      startDate,
      endDate,
      createdById: session.user.id,
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
