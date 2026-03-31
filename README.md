# NestUp Work Process Tracker

Full-stack work management system — task dependencies, role-based dashboards, and DAG visualization.

**Stack:** React + Vite · Supabase (Auth + DB) · React Flow · Vercel

---

## Setup (5 steps)

### 1. Create Supabase project
- [supabase.com](https://supabase.com) → New Project
- SQL Editor → paste `supabase_schema.sql` → Run

### 2. Create demo users
Dashboard → Authentication → Users → Add user:
- `admin@nestup.com` / `admin123`
- `member@nestup.com` / `member123`

Then in SQL Editor (replace UUIDs from Auth → Users):
```sql
INSERT INTO public.profiles (id, email, name, role, skills) VALUES
  ('<admin-uuid>', 'admin@nestup.com', 'Admin User', 'admin', ARRAY['React','Node']),
  ('<member-uuid>', 'member@nestup.com', 'Demo Member', 'member', ARRAY['React','CSS']);
```

### 3. Environment
```bash
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Run locally
```bash
npm install && npm run dev
```

### 5. Deploy to Vercel
Push to GitHub → import on Vercel → add env vars → deploy.

---

## Features

**User Management** — Admin + Member roles, JWT auth, separate protected dashboards

**Work Items** — Title, description, priority, progress (0-100%), skills, assignment, blocked reason

**Dependency System:**
- Full dependency: predecessor must reach 100%
- Partial dependency: predecessor must reach threshold% (1-99%)
- Cycle detection: iterative DFS, rejects circular chains
- Cascade unblock: updating progress auto-unblocks all downstream items
- Threshold=0 guard: rejected — would make dependency meaningless

**Admin Dashboard** — Kanban board, List view, Process Flow DAG, bottleneck panel, member workload with overload alerts

**Member Dashboard** — Assigned tasks, progress slider, mark blocked with reason, downstream impact preview, cascade unblock notification

---

## Dependency Algorithm

```
wouldCreateCycle(from, to, existingDeps):
  Build adjacency graph from existingDeps
  DFS from `to` — if we reach `from`, adding from→to = cycle → reject

cascadeStatusUpdates(updatedItemId, allItems, allDeps):
  BFS from updatedItemId through forward edges
  For each successor: re-evaluate all its incoming deps
  If all deps met → auto-set status = 'in-progress'
  Continue propagating downstream
```

## Project Structure

```
src/
├── lib/dependencyEngine.js   # Pure functions: cycle detect, cascade, bottlenecks
├── lib/supabase.js           # Supabase client
├── context/AuthContext.jsx   # Auth state
├── hooks/useData.js          # Data fetching + mutations
├── components/
│   ├── UI.jsx                # Badges, ProgressBar, Modal, etc.
│   ├── WorkItem.jsx          # Card + Form
│   ├── DependencyPanel.jsx   # Per-item dep management
│   └── ProcessFlow.jsx       # React Flow DAG
└── pages/
    ├── Login.jsx
    ├── AdminDashboard.jsx
    └── MemberDashboard.jsx
```

## Database

```
profiles      → id, email, name, role, skills[]
work_items    → id, title, description, priority, status, progress,
                required_skills[], assigned_to, blocked_reason, created_by
dependencies  → id, predecessor_id, successor_id, type, threshold
```

## Edge Cases

| Scenario | Handling |
|---|---|
| Circular dependency | DFS detects → error shown, save blocked |
| Threshold = 0 | Rejected with explanation |
| Self-loop | Caught before DFS |
| Member overload (>3 active) | Warning in admin sidebar |
| Progress = 100 | Auto-sets status to done, cascades |
| Deep chain A→B→C→D | BFS propagates through all levels |
