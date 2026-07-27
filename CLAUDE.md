# CLAUDE.md - sedres-fe

> **Role:** Senior Frontend Architect | **Style:** Concise, Action-Oriented

---

## ⚡ COMMANDS

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Prod build → `dist/` |
| `npm run preview` | Preview prod build |
| `npm run deploy` | Build + deploy to `gh-pages` |
| `npx eslint .` | Lint (no script in package.json) |
| **No test runner** | No test framework installed |

---

## 🔥 CRITICAL RULES

### ✅ MUST DO
- **Branch:** Switch to `development`, pull latest, then create feature branch
- `base: '/'` in vite.config.js (cPanel deploy; was `/sedres-fe/` for old GH Pages setup)
- Feature SCSS: `src/design/scss/feature-name.scss`
- Bootstrap/react-bootstrap classes (default)
- Override shared styles with 3-4 class specificity
- Use existing API endpoints and payload structures
- Reuse existing service functions where possible
- Follow Gateway → Service → Zustand Store → Component flow

### 🚫 NEVER DO

| Rule | Impact |
|------|--------|
| Push/pull to/from `main` | Senior dev only - NEVER touch main |
| Update `development` directly | Always create feature branch |
| Commit `server.proxy` to vite.config.js | Breaks ALL deployments |
| Edit shared SCSS (`common.scss`, `table-common.scss`, etc.) | Regresses 20+ pages |
| Inline styles (`style={{...}}`) | Violates styling standards |
| Direct `Gateway` calls in components | Breaks architecture |
| Direct `react-toastify` calls | Use `useAlertReducer` |
| Merge modal states (`{show, data}`) | Use separate useState pairs |
| Add to existing shared SCSS | Create dedicated file |
| Modify API endpoints or payloads | Unless explicitly requested |
| Create new service if existing one works | Reuse when possible |

---

## 💬 COMMUNICATION

- **Languages:** User may write in Sinhala, English, or a mix of both — understand both, reply in whichever language (or mix) the user used.
- **Token efficiency:** Keep responses short and direct. No restating the question, no filler, no unrequested summaries.
- **Priority:** Fast and accurate over exhaustive. Give the direct answer/fix first; skip background explanation unless asked.

---

## 🌿 BRANCH WORKFLOW

```bash
# Step 1: NEVER touch main
git checkout development          # Switch to development
git pull origin development       # Get latest changes
git checkout -b feature/your-feature-name  # Create feature branch

# Step 2: Work on your feature
git add .
git commit -m "feat: description"
git push origin feature/your-feature-name

# Step 3: Create PR → Senior reviews → Merges to development
```