# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.



# Frontend Technical Documentation

**Document version:** 1.0
**Generated from repository state on:** 2026-08-05
**Repository (local):** `kanbanBoardFE`

---

## 1. Project Overview

| Item | Detail |
|---|---|
| Project name | `kanbanboardfe` (`package.json` → `name`), referred to internally as **Sedres** (see `CLAUDE.md`, `.cpanel.yml` deploy path `sedres.onlinebareed.com`) |
| Purpose | A large, multi-module enterprise operations platform for maritime/port logistics. It centers on Kanban-style operational boards (DA Desk, Jubail Operations, Ras Tanura Operations, Coordinator Transport, Driver, Taxi/Boat Captain & Operator, MWP, GRO, Hotel, Admin) alongside master-data management (vessels, crew, billing, drivers, hotels, hospitals, transport companies, waste, etc.), KPI dashboards, and vendor/medical/transport/hotel/in-house-driver portals |
| Framework | React 18 (`react` ^18.3.1, `react-dom` ^18.3.1) |
| Build tool | Vite ^7.1.7 (`vite.config.js`), using `@vitejs/plugin-react` |
| Programming language | JavaScript (JSX). No TypeScript is configured — `@types/react` and `@types/react-dom` are present as dev dependencies only, likely for editor IntelliSense; there are no `.ts`/`.tsx` source files |
| Repository overview | Single-page application (SPA) bootstrapped with the standard Vite + React template (see `README.md`), heavily extended into a full enterprise app. It contains 93 page modules (`src/pages`), 78 Zustand stores (`src/store`), and 88 API service modules (`src/services`) |

---

## 2. Technology Stack

### Core

| Technology | Version | Purpose |
|---|---|---|
| React | ^18.3.1 | UI library |
| React DOM | ^18.3.1 | DOM renderer for React |
| Vite | ^7.1.7 | Dev server & build tool |
| @vitejs/plugin-react | ^5.0.4 | Babel-based Fast Refresh for Vite |
| react-router-dom | ^7.9.5 | Client-side routing |
| zustand | ^5.0.8 | Global/local state management |
| axios | ^1.13.2 | HTTP client / API communication |

### Authentication

| Technology | Version | Purpose |
|---|---|---|
| @azure/msal-browser | ^5.17.1 | Microsoft Entra ID (Azure AD) authentication core |
| @azure/msal-react | ^5.5.3 | React bindings for MSAL (login/session, used for Outlook/Graph mail integration) |

### UI / Styling / Component Libraries

| Technology | Version | Purpose |
|---|---|---|
| sass-embedded | ^1.93.3 | SCSS compilation (dev dependency) |
| bootstrap | ^5.3.8 | Base CSS framework / grid / utility classes |
| react-bootstrap | ^2.10.10 | React components wrapping Bootstrap |
| @mui/material | ^9.0.0 | Material UI component library |
| @mui/x-date-pickers | ^9.0.2 | MUI date/time picker components |
| @emotion/react / @emotion/styled | ^11.14.0 / ^11.14.1 | CSS-in-JS engine required by MUI |
| lucide-react | ^1.16.0 | Icon set |
| react-icons | ^5.5.0 | Icon set |
| react-colorful | ^5.6.1 | Color picker UI |
| react-select | ^5.10.2 | Enhanced select/dropdown component |
| react-datepicker | ^9.1.0 | Date picker component |
| react-phone-input-2 | ^2.15.1 | Phone number input with country codes |
| react-loading-skeleton | ^3.3.1 | Skeleton loading placeholders |
| react-toastify | ^11.0.5 | Toast notifications |
| react-tooltip | ^5.30.0 | Tooltips |
| @hello-pangea/dnd | ^18.0.1 | Drag-and-drop (used for Kanban board card/column dragging) |
| recharts | ^3.5.1 | Charting library (KPI/Analytics dashboards) |

### Rich Text, Documents & Data

| Technology | Version | Purpose |
|---|---|---|
| quill / react-quill / react-quill-new | ^2.0.3 / ^2.0.0 / ^3.8.3 | Rich text editing (multiple Quill integrations present) |
| quill-table-better | ^1.2.3 | Table support plugin for Quill |
| dompurify | ^3.4.12 | HTML sanitization (XSS protection for rich text content) |
| pdfjs-dist | ^5.7.284 | PDF rendering/parsing |
| jspdf | ^4.2.1 | PDF generation/export |
| html2canvas | ^1.4.1 | DOM-to-canvas capture (used with jsPDF for exports) |
| xlsx | ^0.18.5 | Excel import/export |
| msgreader | ^1.0.1 | Parsing Outlook `.msg` email files |

### Date/Time & Utilities

| Technology | Version | Purpose |
|---|---|---|
| date-fns | ^4.1.0 | Date utilities |
| dayjs | ^1.11.20 | Date utilities (used with MUI date pickers) |
| moment | ^2.30.1 | Date utilities (legacy usage alongside dayjs/date-fns) |
| lodash | ^4.17.21 | General-purpose utility functions |
| prop-types | ^15.8.1 | Runtime prop type validation |
| react-hook-form | ^7.66.1 | Form state management & validation |

### Linting & Formatting

| Technology | Version | Purpose |
|---|---|---|
| eslint | ^9.39.1 | JavaScript/JSX linting |
| @eslint/js | ^9.36.0 | ESLint recommended JS rule sets |
| eslint-plugin-react | ^7.37.5 | React-specific lint rules |
| eslint-plugin-react-hooks | ^5.2.0 | Rules of Hooks linting |
| eslint-plugin-react-refresh | ^0.4.22 | Fast Refresh compatibility linting |
| eslint-plugin-prettier | ^5.5.4 | Runs Prettier as an ESLint rule |
| eslint-config-prettier | ^10.1.8 | Disables ESLint rules that conflict with Prettier |
| prettier | ^3.6.2 | Code formatting |
| globals | ^16.4.0 | Global variable definitions for ESLint |

### Deployment Tooling

| Technology | Version | Purpose |
|---|---|---|
| gh-pages | ^6.3.0 | Publishes the `dist` build to a `gh-pages` branch |

---

## 3. Project Structure

High-level layout under `src/`:

| Folder | Purpose |
|---|---|
| `src/main.jsx` | Application entry point — initializes MSAL, mounts React root, provides the router |
| `src/App.jsx` | Root application shell — toast container, global modals (`FirstLoginPasswordModal`), and the router `Outlet` |
| `src/pages/` | 93 top-level feature/page modules (one folder per business module — e.g., `KanbanBoard`, `Crew`, `BillingEntity`, `VendorPortal`, `Workspaces`). Most page folders contain their own `Modals/`, `RenderCells.jsx`, and sub-components |
| `src/components/` | 16 shared, cross-page UI components (e.g., `CustomModal.jsx`, `customTable.jsx`, `CommonFilter.jsx`, `DeleteConfirmationModal.jsx`, `PermissionGuard.jsx`, `Toaster.jsx`) |
| `src/structure/` | Application shell/chrome: `Layout` (main page frame), `Header`, `SideNav` (with its own `components/` subfolder) |
| `src/services/` | 88 API service modules — one per domain (e.g., `authService.js`, `crewService.js`, `kanbanBoardService.js`), each wrapping `Gateway` (axios) calls to backend endpoints |
| `src/store/` | 78 Zustand store modules ("Reducers", e.g., `AuthReducer.js`, `KanbanManagementReducer.js`, `AlertReducer.js`) — one store per domain, holding state + async actions that call the corresponding service |
| `src/router/` | Routing configuration: `index.jsx` (route tree), `paths.js` (route path constants), `PrivateRoute.jsx`, `PublicRoute.jsx`, `PermissionRoute.jsx`, `RouteGuard.jsx`, `rolePermissions.js` |
| `src/gateway/gateway.js` | Configured Axios instance with request/response interceptors (auth token attachment, 401 refresh-token flow) |
| `src/config/msalConfig.js` | Azure AD (MSAL) authentication configuration and instance |
| `src/shared/` | Cross-cutting code: `constants/` (permissions, roles, statuses, ports, etc.), `helpers/` (data mappers, formatters, static data), `hooks/` (`usePermissions`, `useGoogleMaps`, `useWindowSize`, etc.), `context/` (`LayoutViewContext`), `store/` (a few additional domain stores), `utils/` (permission-checking and general utilities) |
| `src/design/` | Styling: `scss/` (component/page-level SCSS partials, `partials/` for variables/mixins/fonts) and `css/` (compiled/common/component CSS) |
| `src/assets/` | Static assets — images, icons, logos, backgrounds |
| `public/` | Static files served as-is (favicon, `mock-documents/` sample PDFs) |

Root-level items of note: `docs/` (a prebuilt static output, used as the GitHub Pages publish target per `homepage` in `package.json`), `scripts/update-shared-imports.mjs` (a maintenance script), `dist/` (build output, git-ignored).

---

## 4. Application Architecture

### Entry point

`index.html` loads `src/main.jsx` as a module script. `main.jsx`:
1. Registers an MSAL event callback to set the active account on login.
2. Initializes the MSAL instance and handles any Azure AD redirect promise.
3. Mounts the React tree wrapped in `MsalProvider` and `RouterProvider`.

`src/App.jsx` is the router's root element: it renders a global `ToastContainer`, a `Toaster` component (store-driven toast dispatcher), a `FirstLoginPasswordModal`, and the router `Outlet`.

### Routing

Routing uses `react-router-dom` v7's `createBrowserRouter` (`src/router/index.jsx`), with `basename` derived from `import.meta.env.BASE_URL`. The route tree is layered:

- **Always-public paths** — login, forget/reset password, and standalone KPI dashboard routes (rendered with no app shell).
- **`PublicRoutes`** (`src/router/PublicRoute.jsx`) — wraps login/forgot/reset-password routes.
- **`PrivateRoutes`** (`src/router/PrivateRoute.jsx`) — gate requiring `isLoggedIn`; also refreshes the user profile on load and shows a spinner while auth/profile state resolves.
- **`Layout`** (`src/structure/Layout/index.jsx`) — the authenticated app shell (header + side navigation + content outlet), applied to nearly all private routes.
- **`RouteGuard`** (`src/router/RouteGuard.jsx`) — per-route authorization combining three mechanisms: a legacy role-based route table (`rolePermissions.js`), a newer module/submodule/action permission map derived from the backend user profile, and special-cased logic for "restricted board users" and vendor/portal roles (each redirected to their own allowed subset of routes).
- **`PermissionRoute`** (`src/router/PermissionRoute.jsx`) — used for fully-migrated features (e.g., `/workspaces`, `/edit-workflow`, `/users`) where only the new permission system is authoritative (`permissionOnly`), bypassing the legacy role table.

### State management

State is managed with **Zustand** — one store per domain in `src/store/*Reducer.js` (78 files) plus a few additional domain stores under `src/shared/store/`. Each store typically:
- Holds domain state (lists, loading flags, selected records, error/success messages).
- Exposes async action methods that call the matching `src/services/*Service.js` module and update state with the result.
- Is consumed in components via Zustand's selector-hook pattern, e.g. `useAuthReducer((state) => state.isLoggedIn)`.

There is no Redux/Context-based global store; React Context (`LayoutViewContext`) is used narrowly for layout/view UI state, not domain data.

### API communication

All HTTP calls go through a single configured Axios instance, `Gateway` (`src/gateway/gateway.js`), plus a parallel `RefreshGateway` instance (interceptor-free, used only for refresh calls to avoid recursive interception):
- Base URL is built from `VITE_API_ENDPOINT`, automatically normalized to end in `/api/`.
- A request interceptor attaches `Authorization: Bearer <accessToken>` from `localStorage`, and strips the `Content-Type` header for `FormData` payloads so the browser can set the multipart boundary.
- A response interceptor catches `401` responses, attempts a silent token refresh via `users/refresh_token` using the stored `refreshToken`, queues concurrent requests during the refresh, retries the original request on success, and clears all auth tokens on failure.

Each domain has a dedicated service module (e.g., `src/services/crewService.js`, `src/services/kanbanBoardService.js`) that wraps `Gateway` calls with domain-specific endpoint paths and parameters; stores call these services rather than calling `Gateway` directly.

### Authentication & authorization

Two authentication mechanisms coexist:
1. **Application login** — email/password login handled by `authService.js` and `AuthReducer.js` (`src/store/AuthReducer.js`), issuing `accessToken`/`refreshToken` pairs persisted in `localStorage` and refreshed via the Gateway interceptor described above.
2. **Microsoft Entra ID (MSAL)** — configured in `src/config/msalConfig.js` using `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID`, and `VITE_MICROSOFT_REDIRECT_URI`, requesting `User.Read`, `Mail.Read`, and `Mail.Send` scopes. This is used for Outlook/Graph mail features (see `OutlookReducer.js`), not as the primary app login.

Authorization is enforced client-side (not a security boundary on its own — see the comment in `src/components/PermissionGuard.jsx`) through:
- A legacy **role-based** route/action table (`src/router/rolePermissions.js`, `src/shared/constants/roles.js`).
- A newer **module/submodule/action permission map** derived from the backend user profile response (`getuserdetail`) and normalized in `src/shared/utils/permissions.js`, checked via `usePermissions()` (`src/shared/hooks/usePermissions.js`), `<PermissionGuard>`, and `<PermissionRoute>`.
- Special-cased role classes: "restricted board users" (`src/shared/helpers/restrictedBoardUser.js`) and vendor/portal roles (`src/shared/helpers/vendorDashboardRoles.js`), each confined to their own allowed route subset with dedicated fallback/dashboard redirects.

The codebase comments indicate this dual role/permission system is an intentional, in-progress migration — new fully-migrated features rely solely on the permission map, while legacy features still fall back to the role table.

### Component architecture

- **Page components** (`src/pages/<Feature>/index.jsx`) own a feature's top-level layout and data orchestration, composing shared components (`CustomModal`, `customTable`, `CommonFilter`, etc.) with feature-specific `Modals/` and `RenderCells.jsx` (table cell renderers) local to that page folder.
- **Shared components** (`src/components/`) are generic, reusable UI primitives (modals, tables, filters, loaders, confirmation dialogs) used across many pages.
- **Structural components** (`src/structure/`) render the persistent app chrome (`Header`, `SideNav`, `Layout`) and adapt based on route (e.g., hiding the sidebar on `/edit-workflow`, switching to a full-width Kanban layout, or a portal-specific header for vendor/medical/transport/hotel/in-house-driver portals).
- Guard components (`PermissionGuard`, `RouteGuard`, `PermissionRoute`) are composed around page elements to control conditional rendering/access rather than duplicating permission checks per page.

### Architecture flow diagram

```
User Interaction
       │
       ▼
 React Component (src/pages/**, src/components/**)
       │  reads/dispatches via Zustand hook
       ▼
 Zustand Store (src/store/*Reducer.js)
       │  calls
       ▼
 Service Layer (src/services/*Service.js)
       │  calls
       ▼
 Gateway (src/gateway/gateway.js — Axios instance)
       │  HTTP (Bearer token, auto-refresh on 401)
       ▼
 Backend API (VITE_API_ENDPOINT)
       │
       ▼
 Response → Store updates state → Component re-renders
```

Routing/auth sits alongside this flow: `react-router-dom` resolves the URL → `PrivateRoute`/`PublicRoute` checks login state (from `AuthReducer`) → `RouteGuard`/`PermissionRoute` checks role/permission state (from `AuthReducer`'s `permissionMap`) → the matched page component mounts inside `Layout`.

---

## 5. UI & Styling

### Styling approach

The project uses **SCSS** as its primary styling method (`src/design/scss/`, compiled via `sass-embedded`), organized as one `.scss` file per page/feature (e.g., `dashboard.scss`, `invoice.scss`, `sidebar.scss`, `login.scss`) plus a `partials/` folder for shared tokens (`_variables.scss`, `_mixins.scss`, `_fonts.scss`) aggregated through `_partials.scss`. A `src/design/css/` folder also exists for common/component-level plain CSS.

Alongside SCSS, the project layers in:
- **Bootstrap 5** (global CSS import in `index.html` via CDN, plus the `bootstrap`/`react-bootstrap` npm packages) for grid, utility classes, and some prebuilt components.
- **MUI (Material UI)** with Emotion for specific components (notably date pickers via `@mui/x-date-pickers`).

This mix means styling is not based on a single design system/utility framework (no Tailwind is present) but a hybrid of custom SCSS + Bootstrap + MUI.

### Theme and typography

- **Font:** Manrope (weights 400–800), loaded via Google Fonts `<link>` tags in `index.html`; declared as `$font-primary` in `src/design/scss/partials/_variables.scss`.
- **Brand/theme colors** are defined as SCSS variables in `_variables.scss`, e.g. `$colorPrimary: #00368C`, `$header-bg: #1A273C`, `$light-blue: #2D6EEE`, `$txtColor: #35475E`.
- A newer, additive **design-token layer** (spacing scale, radius scale, shadows, card/table/status-badge tokens) has also been added to `_variables.scss` — per an in-file comment, these tokens are not yet consumed anywhere and have no current visual effect, representing a planned future consolidation.
- Responsive breakpoints are defined as SCSS variables (`$lg-*` for `min-width`, `$sm-*` for `max-width`) covering common device widths from 320px up to 1679px.

### Reusable components

Shared, cross-feature components live in `src/components/` (16 files), including generic modal (`CustomModal.jsx`), table (`customTable.jsx`), filter (`CommonFilter.jsx`), skeleton/loading (`CommonSkeleton.jsx`, `CardTabListLoading.jsx`, `CustomLoader.jsx`), confirmation dialogs (`DeleteConfirmationModal.jsx`, `StatusConfirmationModal.jsx`, `LogoutConfirmationModal.jsx`), empty-state (`NoTableData.jsx`), and access-control (`PermissionGuard.jsx`) components. Feature-specific but still reusable pieces (e.g., per-page modals) live alongside their owning page under `src/pages/<Feature>/Modals/`.

### Responsive design approach

Responsiveness is handled through SCSS breakpoint variables/mixins (`_variables.scss`, `_mixins.scss`) combined with Bootstrap's responsive grid/utility classes, plus a `useWindowSize` hook (`src/shared/hooks/useWindowSize.js`) for viewport-aware logic in components (e.g., the mobile sidebar toggle in `Layout`/`Header`).

### UI best practices observed

- Centralized Axios instance with interceptors rather than ad-hoc fetch calls per component.
- Sanitization of rich-text HTML via `dompurify` before rendering (XSS mitigation) — see `src/shared/helpers/sanitizeAppointmentEmailBody.js`.
- Skeleton loaders and explicit loading states are used rather than blank screens during data fetches.
- Component-level guard patterns (`PermissionGuard`, `RouteGuard`) centralize authorization checks instead of duplicating conditionals across pages.
- Code-splitting is configured at the build level via manual chunking (see Section 6).

---

## 6. Development & Build

| Item | Detail |
|---|---|
| Node.js version | **Not Found** — no `engines` field in `package.json` and no `.nvmrc`/`.node-version` file in the repository |
| Installation | `npm install` |
| Development command | `npm run dev` → runs `vite` (dev server with HMR) |
| Build command | `npm run build` → runs `vite build`, output to `dist/` |
| Preview command | `npm run preview` → serves the production build locally via Vite |
| Environment variables (names only) | `VITE_API_ENDPOINT`, `VITE_GRO_ENABLE_DOC_VERIFY_GATE`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID`, `VITE_MICROSOFT_REDIRECT_URI` (defined in `.env`, which is git-ignored per `.gitignore`) |
| Build output folder | `dist/` (configured via `build.outDir` in `vite.config.js`; git-ignored) |
| Build optimization | `vite.config.js` defines manual Rollup chunks to split large dependency groups into separate bundles: `mui`, `quill`, `pdf`, `dates`, `msal`, `bootstrap` |
| Linting | `eslint.config.js` (flat config) — recommended JS rules + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`, targeting `**/*.{js,jsx}`, with `dist` ignored |
| Formatting | `.prettierrc` — single quotes, semicolons, ES5 trailing commas, 100-character print width |

---

## 7. Deployment

Two deployment paths are configured in the repository:

### 1. GitHub Pages (`gh-pages` package)

- `homepage` in `package.json`: `https://infobahn-martech.github.io/sedres-fe/`
- `npm run deploy` first runs `predeploy` (`npm run build && cp dist/index.html dist/404.html` — the 404 copy is an SPA-routing fallback technique for GitHub Pages), then publishes the `dist/` folder to the `gh-pages` branch via the `gh-pages` CLI (`gh-pages -d dist -b gh-pages --dotfiles`).
- A `docs/` folder in the repo root contains a previously built static bundle (hashed asset filenames consistent with a Vite production build), suggesting GitHub Pages may alternatively be configured to serve from `/docs` on a branch — this cannot be confirmed from the repository alone (**Not Found**: which serving mode is actually enabled in the GitHub repository settings).

### 2. cPanel deployment

- `.cpanel.yml` defines a deployment task set targeting `DEPLOYPATH=/home/onlirdcv/sedres.onlinebareed.com/`:
  1. Removes the existing `assets` directory at the deploy path.
  2. Deletes all top-level files at the deploy path **except** `.htaccess` (preserving any existing server rewrite rules for SPA routing).
  3. Copies the contents of `dist/` into the deploy path.
- No `.htaccess` file exists in this repository; it is expected to already exist on the target server (explicitly preserved by the `.cpanel.yml` script) and is not version-controlled here.

### Production build workflow

`npm run build` → Vite bundles the app into `dist/` (with the manual chunk splitting described in Section 6) → the appropriate deployment task (`npm run deploy` for GitHub Pages, or a cPanel Git-deployment trigger reading `.cpanel.yml`) publishes `dist/` to the target host.

---

## 8. Best Practices & Recommendations

### Folder organization

The `pages → components → services → store` separation is consistently applied, and the API/service/store split (Section 4) gives a clean, traceable data flow. At 93 page modules, 88 services, and 78 stores, the codebase is large; a further grouping of `src/pages/` and `src/store/` into domain sub-directories (e.g., `pages/kanban/*`, `pages/masterData/*`) could improve navigability, though this is a structural change beyond the scope of this document.

### Component structure

Reusable primitives are appropriately centralized in `src/components/`, while feature-specific modals/renderers stay colocated with their owning page — a sound pattern that limits unnecessary cross-page coupling.

### API and state management patterns

The one-service-per-domain + one-store-per-domain convention is consistent and easy to follow. The dual authorization system (legacy role table + new permission map, both documented in code comments as an intentional in-progress migration — see `RouteGuard.jsx` and `PermissionGuard.jsx`) is a notable area of technical debt: once the permission-map migration is complete for all modules, the legacy `rolePermissions.js` role table should be removed to avoid maintaining two parallel authorization paths.

### Naming conventions

Store files are consistently suffixed `Reducer.js` (a naming holdover from a Redux-like convention, though the implementation is Zustand, not Redux). Service files are consistently suffixed `Service.js`. Component and page files use PascalCase; helper/utility files use camelCase.

### Areas for improvement

- **Date library consolidation**: `moment`, `dayjs`, and `date-fns` are all present as dependencies simultaneously — standardizing on one would reduce bundle size and maintenance overhead.
- **Rich text editor consolidation**: `quill`, `react-quill`, and `react-quill-new` are all present — likely reflecting an in-progress migration; consolidating to one would reduce duplication.
- **Design tokens**: the newer spacing/radius/shadow/status token set in `_variables.scss` is defined but not yet adopted anywhere in the codebase (per its own in-file comment) — rolling it out consistently would reduce ad hoc styling values across the many per-page SCSS files.
- **TypeScript**: `@types/react`/`@types/react-dom` are installed but the codebase is plain JavaScript/JSX; adopting TypeScript incrementally could improve type safety given the codebase's size.
- **Node engine pinning**: no `engines` field or `.nvmrc` is defined, which risks environment drift between developer machines and CI/deploy environments.

---

## 9. Conclusion

This is a large, single-page React 18 application built with Vite, structured around a consistent four-layer architecture — **API (Axios `Gateway`) → Service → Zustand Store → Page/Component** — covering 93 feature modules for an enterprise maritime/port-operations platform (Kanban operational boards, master-data management, KPI dashboards, and multiple external-party portals). Routing is handled by `react-router-dom` v7 with a layered guard system combining a legacy role-based table and a newer backend-driven permission map, and authentication combines a first-party email/password + refresh-token flow with optional Microsoft Entra ID (MSAL) integration for Outlook/Graph features. Styling is a hybrid of custom SCSS (with brand tokens and an emerging design-token layer), Bootstrap 5, and Material UI. The codebase is functional and consistently patterned, with clear opportunities to reduce duplicated tooling (multiple date and rich-text libraries), formalize the in-progress permission-system migration, and adopt the newly-introduced but unused design tokens more broadly.
