import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assigneeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
});

async function getTaskIfAllowed(taskId, userId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { task: null, allowed: false };

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId: task.projectId } },
  });

  return { task, allowed: Boolean(membership) };
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = params;
  const { task, allowed } = await getTaskIfAllowed(taskId, session.user.id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const update = { ...parsed.data };

  if (Object.prototype.hasOwnProperty.call(update, "startDate")) {
    update.startDate = update.startDate ? new Date(`${update.startDate}T00:00:00.000Z`) : null;
  }
  if (Object.prototype.hasOwnProperty.call(update, "endDate")) {
    update.endDate = update.endDate ? new Date(`${update.endDate}T00:00:00.000Z`) : null;
  }
  const effectiveStart = Object.prototype.hasOwnProperty.call(update, "startDate") ? update.startDate : task.startDate;
  const effectiveEnd = Object.prototype.hasOwnProperty.call(update, "endDate") ? update.endDate : task.endDate;
  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  if (Object.prototype.hasOwnProperty.call(update, "assigneeId")) {
    if (update.assigneeId) {
      const assigneeMember = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: update.assigneeId, projectId: task.projectId } },
      });
      if (!assigneeMember) return NextResponse.json({ error: "Assignee must be a project member" }, { status: 400 });
    } else {
      update.assigneeId = null;
    }
  }

  let tagWrite;
  if (Object.prototype.hasOwnProperty.call(update, "tagIds")) {
    const tagIds = update.tagIds || [];
    const validTags = await prisma.tag.findMany({
      where: {
        projectId: task.projectId,
        id: { in: tagIds },
      },
      select: { id: true },
    });
    if (validTags.length !== tagIds.length) {
      return NextResponse.json({ error: "Some tags are invalid for this project" }, { status: 400 });
    }
    tagWrite = {
      deleteMany: {},
      create: tagIds.map((tagId) => ({ tagId })),
    };
    delete update.tagIds;
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...update,
      ...(tagWrite ? { tags: tagWrite } : {}),
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

  return NextResponse.json({ task: updated });
}

export async function DELETE(_request, { params }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = params;
  const { task, allowed } = await getTaskIfAllowed(taskId, session.user.id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
