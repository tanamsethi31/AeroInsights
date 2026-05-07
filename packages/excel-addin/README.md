# Aeroinsights Excel Add-in

Live aviation finance analytics in Excel — 20 custom `AER.*` worksheet functions
pulling ECL, maintenance reserves, counterparty risk, and portfolio KPIs directly
from the Aeroinsights API.

---

## Architecture overview

```
Excel cell: =AER.ECL("LSE-2019-001","Baseline","2026-04-29")
                │
        shared JS runtime (task pane webview)
                │
        public/functions/functions.js  ← plain ES2020, no bundler
                │
        GET https://api.aerinsights.com/api/v1/excel/ecl?...
                │
        FastAPI  backend/app/api/v1/endpoints/excel.py
```

**Shared runtime**: the task pane and custom functions run in the **same** JavaScript
context (configured via `<Runtimes lifetime="long">` in the manifest). This means:
- localStorage is shared — token written by task pane is readable by functions
- Custom functions can use `await`/`async` with full Office.js support

---

## Prerequisites

- Node ≥ 18
- Microsoft 365 subscription (Excel Desktop or Excel Online)
- Office Add-ins developer mode enabled (see sideloading section)

---

## Local development

### 1. Install dependencies

```bash
cd packages/excel-addin
npm install
```

### 2. Create `.env.local`

```env
VITE_AUTH0_DOMAIN=your-tenant.eu.auth0.com
VITE_AUTH0_CLIENT_ID=your_addin_client_id
VITE_AUTH0_AUDIENCE=https://api.aeroinsights.io
VITE_API_BASE_URL=https://api.aerinsights.com/api/v1
```

> **Auth0 client**: create a separate Auth0 **Single Page Application** for the add-in
> (not the same client as the main web app). Add `https://localhost:3100/auth-dialog.html`
> and `https://addin.aerinsights.com/auth-dialog.html` to **Allowed Callback URLs**.

### 3. Start dev server

```bash
npm run dev
```

The add-in is served at `https://localhost:3100` with a self-signed HTTPS certificate
(required by Office). On first run, you may need to trust the cert in your OS keychain.

### 4. Validate the manifest

```bash
npm run validate-manifest
```

---

## Sideloading the manifest

### Mac — Excel Desktop

1. Quit Excel if open.
2. Create the WEF directory if it doesn't exist:
   ```bash
   mkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef
   ```
3. Copy the manifest:
   ```bash
   cp packages/excel-addin/manifest.xml \
     ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
   ```
4. Open Excel → **Tools** → **Excel Add-ins** → select the Aeroinsights add-in.
5. If the add-in doesn't appear, go to **Insert** → **Add-ins** → **My Add-ins** → **Shared Folder**.

### Windows — Excel Desktop

1. Create a local shared folder, e.g. `C:\AeroinsightsAddin`.
2. Copy `manifest.xml` into that folder.
3. In Excel: **File** → **Options** → **Trust Center** → **Trust Center Settings**
   → **Trusted Add-in Catalogs**.
4. Add `C:\AeroinsightsAddin` as a catalog URL. Check **Show in Menu**.
5. Restart Excel → **Insert** → **My Add-ins** → **Shared Folder** → Aeroinsights.

### Excel Online

1. Open a workbook in Excel Online.
2. **Insert** → **Add-ins** → **Upload My Add-in**.
3. Browse to `manifest.xml` and upload.

---

## Signing in

The add-in handles its own Auth0 PKCE authentication — it does **not** share a session
with the main Aeroinsights web app (different origins cannot share localStorage).

1. Open the Aeroinsights task pane from the **Home** ribbon.
2. If not signed in, click **Sign In** — an Auth0 dialog opens.
3. Complete sign-in in the dialog. The token is stored in `localStorage["aerinsights_addin_token"]`
   within the add-in's origin and is immediately accessible to all 20 custom functions
   (shared runtime).

Tokens expire based on your Auth0 settings. When the task pane shows a red dot, click
**Sign In** again.

---

## Environment variables

| Variable | Where used | Purpose |
|---|---|---|
| `VITE_AUTH0_DOMAIN` | Task pane, auth-dialog | Auth0 tenant domain |
| `VITE_AUTH0_CLIENT_ID` | Auth-dialog | Auth0 SPA client ID for the add-in |
| `VITE_AUTH0_AUDIENCE` | Auth-dialog | Auth0 API audience |
| `VITE_API_BASE_URL` | Task pane (api.ts) | API base URL for KPI fetches |
| `API_BASE` in functions.js | Custom functions | **Hardcoded** — must be edited before prod build |

> `functions.js` lives in `public/functions/functions.js` and is NOT processed by Vite.
> It cannot read Vite env vars. Edit `const API_BASE = "..."` directly before each deployment.

---

## Adding a new function

1. **`public/functions/functions.js`** — add the implementation:
   ```javascript
   /**
    * Short description.
    * @customfunction AER.MY_FUNCTION MY_FUNCTION
    * @param {string} param1  Description
    * @returns {Promise<number>} Description
    */
   async function MY_FUNCTION(param1) {
     try {
       const result = await aerFetch(`/excel/my-endpoint?param=${encodeURIComponent(param1)}`);
       if (result === null) return "#AERINSIGHTS - NOT FOUND";
       return result.value;
     } catch (e) {
       return handleError(e);
     }
   }
   ```

2. **Register** in the same file's `Office.onReady()` block:
   ```javascript
   CustomFunctions.associate("AER.MY_FUNCTION", MY_FUNCTION);
   ```

3. **`src/taskpane/TaskPane.tsx`** — add to the `FUNCTIONS` array with group, params, description, example.

4. **`backend/app/api/v1/endpoints/excel.py`** — add the FastAPI endpoint:
   ```python
   @router.get("/my-endpoint")
   async def get_my_endpoint(param: str = Query(...), current_user: User = Depends(get_current_user)):
       # TODO: real query
       return {"value": 42.0}
   ```

5. Run `npm run validate-manifest` — no manifest change needed unless you change the function's
   namespace prefix.

---

## Project structure

```
packages/excel-addin/
├── manifest.xml                   Office Add-in manifest (v1.3 + VersionOverrides 1.0)
├── package.json
├── vite.config.ts                 Multi-page: taskpane + auth-dialog
├── tsconfig.json
│
├── public/
│   └── functions/
│       └── functions.js           ← All 20 AER.* functions (plain ES2020, static)
│
└── src/
    ├── functions/
    │   └── functions.html         Fallback runtime entry (Office loads this when
    │                              shared runtime is not available)
    ├── taskpane/
    │   ├── index.html             Task pane entry (React app + loads functions.js)
    │   ├── main.tsx               Office.onReady → ReactDOM.render
    │   ├── TaskPane.tsx           Full UI: 4 sections
    │   ├── auth-dialog.html       Auth0 dialog page entry
    │   └── auth-dialog.ts        PKCE flow handler
    └── shared/
        └── api.ts                 Typed API client for task pane (not functions.js)
```

---

## Production deployment

The `dist/` folder produced by `npm run build` must be deployed to `https://addin.aerinsights.com`
with these HTTP response headers for every file:

```
Access-Control-Allow-Origin: https://excel.officeapps.live.com, https://*.microsoft.com
Content-Security-Policy: default-src 'self' https://appsforoffice.microsoft.com https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' https://appsforoffice.microsoft.com; connect-src 'self' https://api.aerinsights.com https://*.auth0.com;
```

Also required:
- `https://addin.aerinsights.com` must be added to Auth0's **Allowed Origins** and **Allowed Callback URLs**
- `https://addin.aerinsights.com` must be added to the backend's `CORS_ORIGINS` list in `config.py`  
  (or via the `CORS_ORIGINS` environment variable on EKS)
- `https://localhost:3100` must be in `CORS_ORIGINS` for local development
- Edit `const API_BASE = "..."` in `public/functions/functions.js` to point at the production URL

---

## Backend CORS update required

Add these origins to `backend/app/core/config.py` (or set via env var):

```python
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",              # main app Vite dev
    "http://localhost:3100",              # add-in Vite dev
    "https://app.aeroinsights.io",        # main app prod
    "https://addin.aerinsights.com",      # add-in prod
]
```
