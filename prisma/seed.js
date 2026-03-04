const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const [owner, teammate] = await Promise.all([
    prisma.user.upsert({
      where: { email: "owner@stride.local" },
      update: {},
      create: { name: "Owner", email: "owner@stride.local", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "teammate@stride.local" },
      update: {},
      create: { name: "Teammate", email: "teammate@stride.local", passwordHash },
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "Stride MVP",
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: teammate.id, role: "MEMBER" },
        ],
      },
    },
  });

  const [frontendTag, backendTag, designTag] = await Promise.all([
    prisma.tag.create({ data: { projectId: project.id, name: "frontend", color: "#2563EB" } }),
    prisma.tag.create({ data: { projectId: project.id, name: "backend", color: "#059669" } }),
    prisma.tag.create({ data: { projectId: project.id, name: "design", color: "#D97706" } }),
  ]);

  await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Kickoff board",
      description: "Initial backlog and statuses",
      status: "TODO",
      priority: "MEDIUM",
      createdById: owner.id,
      assigneeId: owner.id,
      startDate: new Date("2026-03-04T00:00:00.000Z"),
      endDate: new Date("2026-03-08T00:00:00.000Z"),
      tags: {
        create: [{ tagId: backendTag.id }, { tagId: designTag.id }],
      },
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Timeline demo",
      description: "Render true Gantt bars with start/end ranges",
      status: "IN_PROGRESS",
      priority: "HIGH",
      createdById: owner.id,
      assigneeId: teammate.id,
      startDate: new Date("2026-03-06T00:00:00.000Z"),
      endDate: new Date("2026-03-17T00:00:00.000Z"),
      tags: {
        create: [{ tagId: frontendTag.id }],
      },
    },
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
