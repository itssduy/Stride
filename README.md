# Stride PM (Next.js + PostgreSQL)

Team-ready MVP project management app with auth, projects, members, and tasks.

## Stack

- Next.js (App Router)
- PostgreSQL + Prisma
- NextAuth (credentials auth)

## Features

- Register/login
- Multi-project workspace
- Team members per project
- Task CRUD
- Task start/end dates
- Project tags with custom colors (multi-tag per task)
- Kanban, Timeline, List, Calendar views
- Role-aware API protection (project members only)

## Quick start

1. Install dependencies:
```bash
npm install
```

2. Start PostgreSQL:
```bash
docker compose up -d
```

3. Configure env:
```bash
cp .env.example .env
```

4. Run migrations + Prisma client:
```bash
npm run prisma:migrate -- --name init
npm run prisma:generate
```

5. (Optional) seed demo data:
```bash
npm run seed
```

6. Start app:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo users (if seeded)

- `owner@stride.local` / `password123`
- `teammate@stride.local` / `password123`

## Team testing flow

1. Each teammate registers an account.
2. Project owner creates a project.
3. Owner adds members by email in the sidebar.
4. Members can log in and work in shared boards.

## Important MVP note

This app uses email/password credentials auth only (no OAuth yet). If you want, next step is adding Google/GitHub SSO and activity logs.
