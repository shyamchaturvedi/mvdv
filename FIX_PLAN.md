# MVD Train Ticket System — Fix & Hardening Plan

> **Handoff document.** Sab kuch self-contained hai — kisi bhi agent ko yeh file de do.
> Repo: `C:\Users\sahil\.gemini\antigravity-ide\scratch\mvd_train_ticket_system`
> Branch: `main` · Remote: `origin` → `github.com/shyamchaturvedi/mvdv`
> Deploy: Vercel (`api/index.js` → poora Express app) + optional Firebase Hosting
> Verified: 2026-10-07

---

## ⚠️ GROUND RULES (pehle padh)

1. **Windows dev machine, Linux/Vercel production.** Local case-insensitive hai, prod nahi.
   Do bugs isi se paida hue hain.
2. **Commit se pehle `git status` / `git diff` zaroor dikha.** Pichla agent uncommitted
   changes chhod gaya tha.
3. **Hindi strings me Devanagari (U+0900–097F) EXACT rehne do.** Koi `Set-Content`,
   `sed`, `echo >`, `-replace` se file mat likho (mojibake ho jaayega). **Edit tool +
   exact `oldString` use karo.**
4. **Ek phase = ek commit.** Phase ke baad Verification section chalao.
5. **Non-goals:** App.jsx refactoring (9,685-line file), UI redesign, naye features.
   Sirf fix.

### Build / verify commands

```bash
node --check server.js
node --check routes/apiRoutes.js && node --check routes/adminRoutes.js
node --check services/authService.js && node --check services/staffService.js
node --check services/pdfService.js
npm --prefix frontend run lint     # target: 0 errors (warnings OK)
npm run build                      # must succeed → regenerates frontend/dist
```

---

## 📌 STATUS SNAPSHOT (audit result)

| Area | State |
|---|---|
| Lint | **0 errors, 61 warnings** ✅ |
| `frontend/dist` | ❌ **stale** (built 05-10, `src/App.jsx` modified 07-10) |
| Working tree | ❌ `App.jsx` 2 lines uncommitted + 5 untracked `fix*.cjs` |
| Security | ❌ **12 critical holes, sab abhi maujood** |
| Broken endpoints | ❌ `/reports/defaulters` 500 · Vercel pe `payment` 500 |
| Dead weight | ❌ ~6.8 MB in dist · 28 MB stale in `public/app/` |

> Git me `83783f2 "remove default hardcoded passwords"` aur `9792431 "security: remove
> default hardcoded admin password"` hain — **dono fail hue.** Password abhi bhi hai.
> Hamesha verify karo, assume mat karo.

---

## PHASE 1 — Working tree + pichle agent ke bugs ⭐ PRIORITY

### 1.1 Receipt print size REGRESSION

Commit `cce93be` ne ye delete kar diya:
```js
'@page { size: 210mm 148mm; margin: 4mm; }'
```
- `frontend/src/App.jsx:149` — `const isReceipt = elementId.includes('receipt')`
  ab **dead** hai (kahin use nahi hota).
- Ab receipt **poore A4 portrait** pe print hoti hai, lekin UI label abhi bhi
  `"A4-Half Payment Receipt Preview"` bolta hai (`App.jsx:8351`).
- Grep: `210mm|148mm` puri codebase me **kahin nahi bacha**.
- `PDFService.generatePaymentSlipPDF` A4-Half (595.28×420.94 pt) hi banata hai →
  screen/PDF mismatch.

**Fix — `printSlipElement` (~line 154):**
```js
const pageStyle = isReceipt
  ? '@page { size: 210mm 148mm; margin: 4mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
  : '@page { size: A4 portrait; margin: 6mm; } body { width: 100%; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }';
```
`printCombinedSlipElements` (ticket+receipt combo) me **A4 portrait rakho** — wo sahi hai.

### 1.2 Blank-print root cause

Wahi bug jiske liye `frontend/fix_print_visibility.cjs` banaya gaya tha.

**Cause:** commit `cce93be` ne `${styles}` injection add kiya (`App.jsx` ~119 aur ~166).
Ab poori `index.css` print window me jaati hai, aur **`frontend/src/index.css:1048`**:
```css
@media print {
  body * { visibility: hidden; }
  .printable-area, .printable-area * { visibility: visible !important; }
}
```
Print area ka class `.printable-area` **nahi** hai (`.irctc-ticket-wrapper` /
`.mandir-receipt-wrapper`) → sab hidden → **khaali page print hota hai.**

**Fix (ek hi choose karo, dono nahi):**
- **(Recommended)** Inline `<style>` ko hamesha last rakho + add:
  ```css
  @media print { body * { visibility: visible !important; } }
  .no-print, .no-print * { display: none !important; visibility: hidden !important; }
  ```
  Yeh `fix_print_visibility.cjs` ka kaam hai — sirf **App.jsx ke andar persist** karo,
  script delete (Phase 5).
- **Alt:** print area ko `printable-area` class do + `visibility: visible !important`.

**Acceptance:** ticket aur receipt dono me content print preview me dikhna chahiye;
`.no-print` toolbars print nahi hone chahiye.

### 1.3 `printCombinedSlipElements` silent-fail

- `App.jsx:1065` → `setTimeout(..., 150)` (pehle 500 tha)
- `App.jsx:103-104` → `if (!elem1 || !elem2) return;` **chup-chaap return**

**Fix:**
1. timeout `150` → **`500`**
2. missing element pe `console.warn` + **fallback** to individual `printSlipElement(...)`
   instead of silent return

**Context:** booking ke baad dono modal set hote hain — `App.jsx:1047`
`setTicketModal(data.booking)` + `App.jsx:1054` `setReceiptModal({booking, txn})`.

### 1.4 Cancel button ke galat default

**`frontend/src/App.jsx:8299`:**
```js
refundAmount: 0,                              // WRONG — zero refund
cancellationCharges: ticketModal.advance || 0 // WRONG — poora advance charge
```

**Badal ke:**
```js
refundAmount: Number(ticketModal.advance) || 0,   // full refund by default
cancellationCharges: 0,
```

**Kyun:** default direction ulta hai. Sirf ek `confirm()` (`App.jsx:735`) protection
hai — user ne bina number dekhe haan bol diya to yatri ka poora advance kat jaata.

### 1.5 Modals stack (minor)

Booking ke baad ticket + receipt dono modal khulte hain → receipt upar aata hai →
ticket ka Cancel button peeche chhup jaata hai.
**Fix:** combined print ke baad `setReceiptModal(null)`, ya receipt modal close-on-print.

### 1.6 Working tree commit

Uncommitted/untracked:
- `frontend/src/App.jsx` (2 lines — print visibility)
- `frontend/fix.cjs`, `fix_cancel.cjs`, `fix_portrait.cjs`,
  `fix_print_visibility.cjs`, `fix_seat.cjs`

→ Fixes App.jsx me apply karo, phir commit. Scripts Phase 5 me delete.

---

## PHASE 2 — CRITICAL SECURITY

### 2.1 Token signature BYPASS ⭐ SABSE ZAROORI

**`services/authService.js:307`:**
```js
if (isSigValid || data.user.role === 'SuperAdmin' || data.user.staffId) {
```

**Fix:**
```js
if (isSigValid) {
```

**Impact:** yeh akela hole kisi ko bhi bina secret ke
`jwt.<base64url {"user":{"role":"SuperAdmin"}}>.<kuch-bhi>` se SuperAdmin bana deta hai.
HMAC check effectively optional hai. Saare `requireAuth()` routes khatam.

### 2.2 Static hardcoded tokens hatao

| Location | Kya hai |
|---|---|
| `services/authService.js:246-258` | `'mvd_admin_token'` → SuperAdmin, `'mvd_tte_session_token'` → TTE. **Puri block delete.** |
| `routes/adminRoutes.js:50` | login response me `token: 'mvd_admin_token'` → band |
| `routes/apiRoutes.js:708` | TTE login `'mvd_tte_session_token'` return → real `AuthService.generateToken(...)` |

### 2.3 Frontend fallbacks — 8 jagah ⚠️ 2.2 ke SAATH ME karo

`|| 'mvd_admin_token'` **hatao** (empty token → 401 → login redirect):

| File:Line | Function |
|---|---|
| `frontend/src/App.jsx:212` | `safeStaffToken` |
| `:618` | `loadAdminCoaches` |
| `:650` | save coach |
| `:693` | edit coach submit |
| **`:739`** | **`cancel booking`** |
| **`:815`** | **`reset default rake`** |
| **`:1635`** | **`loadStaffData`** |
| `:8708` | `<a href="/api/admin/sample-template?token=mvd_admin_token">` → `?token=` hatao |

`:739`, `:815`, `:1635` ab **anonymous SuperAdmin** hain — koi bhi logged-out visitor
cancel/reset/staff-list chala sakta hai.

### 2.4 Missing `requireAuth()` — 4 endpoints (`routes/apiRoutes.js`)

| Line | Endpoint | Lagao |
|---|---|---|
| 203 | `GET /admin/coaches` | `requireAuth()` |
| 785 | `GET /admin/online-transactions` | `requireAuth('financial_reconcile')` |
| **890** | `PUT /admin/transactions/verify-utr` | `requireAuth('verify_payment')` — **unauthenticated financial WRITE** |
| 468 | `PUT /bookings/:id/utr` | `requireAuth()` — public write |

Sab me comment me "SuperAdmin/FinanceOfficer" likha hai, guard lagta nahi.

### 2.5 Plaintext passwords → bcrypt

`bcryptjs` **installed hai + `routes/adminRoutes.js:6` me imported — but 0 uses.**

| Location | Current | Fix |
|---|---|---|
| `services/staffService.js:47` | `password: adminPass \|\| 'admin@mvd2026'` | fallback **delete**; sirf tab seed karo jab `ADMIN_PASSWORD` env set ho |
| `:119` | `password: payload.password` | `bcrypt.hashSync(payload.password, 10)` |
| `:210` | `staff.password !== password` | `bcrypt.compareSync(...)` |
| `:707` | same | same |
| `:714` | `password: newPassword.trim()` | hash |

**Backward compat (zaroori):** purane plaintext docs exist karte hain.
`authenticateStaff` me: agar stored value bcrypt hash nahi (`!startsWith('$2')`) aur
plaintext match kare → **login success + turant rehash**. (Login-time migration.)

**Verify:**
```bash
Select-String -Path services\staffService.js,routes\*.js,server.js -Pattern "admin@mvd2026"  # expect 0
```
`.env` gitignored hai, but `staffService.js:47` **tracked** hai + git history me bhi hai.

### 2.6 Poori booking collection browser me

- `firestore.rules:6-9` → `allow read: if true;` → **Aadhaar/mobile sab public**
  (web config `frontend/src/firebase.js` me hardcoded hai)
- `frontend/src/App.jsx:483-501` → `onSnapshot(collection(db,'bookings'))` poori
  collection browser me laata hai

**Fix:**
1. `onSnapshot` block delete (`App.jsx:483-501`), unused `onSnapshot`/`query`/
   `orderBy` imports cleanup
2. **Safe hai:** `loadAdminDashboard` (`App.jsx:1449`) already REST se
   `setAdminBookings(bkData.bookings)` karta hai (`:1459`), aur `loadAdminDashboard()`
   **8 jagah** call hota hai (`:548` mount, `:756`, `:1412`, `:1438`, `:1474`, `:1491`,
   `:1510`, `:1535`)
3. `firestore.rules` → `allow read: if false` (ya authenticated-staff-only)

### 2.7 Misc

| Location | Issue | Fix |
|---|---|---|
| `server.js:16` | `app.use(cors())` wide open | origin allowlist (`https://mvdv.vercel.app`, localhost) |
| `server.js:22` | `secret: SESSION_SECRET \|\| 'mvd_secret_pilgrimage_key_2026'` | hardcoded fallback hatao, env missing pe fail-fast |
| `services/authService.js:65` | `generateToken` hardcoded fallback secret | dono jagah `SESSION_SECRET` use karo |
| `services/authService.js:289-294` | `validateToken` 4 candidate secrets incl. 3 hardcoded | sirf env secret |
| `services/authService.js:394-404` | `req.session.isAdmin` → no-token SuperAdmin | band karo ya session cookie ko `secure`/`sameSite` do |
| `routes/apiRoutes.js:29` | `google-login` `idToken` padhta hai (`:31`) but **verify nahi** | `admin.auth().verifyIdToken(idToken)` |

> ⚠️ **Risk:** fallback secrets hatane se purane localStorage tokens invalidate honge →
> users dobara login karenge. **Expected hai**, doc me likho.

---

## PHASE 3 — FUNCTIONAL BUGS

### 3.1 `/reports/defaulters` hamesha 500 ⭐

**`routes/adminRoutes.js:183`:**
```js
const { PDFService } = require('../services/pdfService');
```
`services/pdfService.js:671` = `module.exports = PDFService;` — **class, named export
nahi**. Destructure → `undefined` → `PDFService.generateDefaultersReportPDF(...)` →
`TypeError` → 500.

**Fix:** yeh line **delete** karo. Sahi import line 12 pe already hai
(`const PDFService = require('../services/pdfService');`) — bas shadow ho raha hai.

### 3.2 Vercel/Linux crasher ⭐ (Windows pe chalta hai)

**`routes/adminRoutes.js:126`:**
```js
const { StaffService } = require('../services/StaffService');   // capital S
```
Linux/Vercel pe `MODULE_NOT_FOUND` → `PUT /api/admin/bookings/:id/payment` **500**.

**Fix:** `require('../services/staffService')`. (Line 167 pe sahi wala already hai.)

### 3.3 PDF download booking corrupt karta hai

**`routes/apiRoutes.js:511-513`** — `GET /bookings/:id/pdf` booking ka `status`
`'Confirmed'` → `'Downloaded'` kar deta hai.

Ise se dashboard/chart filters toot-ti hain (`services/bookingService.js:193-195,
513, 698-699`), kyunki PDF har baar download hoti hai.

**Fix:** status mutation hatao; audit log (`SLIP_PRINTED`) rakho.

### 3.4 Seat capacity triple mismatch

| Location | Value |
|---|---|
| `services/bookingService.js:518` (`getCoachOccupancy`) | `A*`→54, `B*`→**64**, `S*`→72, else→**80** |
| `services/bookingService.js:758-775` (`getDashboardStats` fallback) | `B1-B3`→**72**, `SLR`→20 |
| `services/coachService.js:4-275` (`DEFAULT_TRAIN_COACHES`) | `B*`→64, `S*`→72, `GS*`→80, **`SLR*`→20** |

**Fix:** ek single source of truth — `coachService.DEFAULT_TRAIN_COACHES` (ya Firestore
`trainCoaches`). `getCoachOccupancy` me **SLR = 20** karo (abhi 80 dikh raha hai — galat
occupancy).

### 3.5 `firebase.json` dead path

`firebase.json:13-16` → `/api/**` → Cloud Function `api`, but **`functions/` dir
exists hi nahi** (`Test-Path functions = False`).
**Fix:** `functions/` add karo, ya Firebase Hosting config hatao.
**Vercel (`vercel.json`) pehle se sahi hai — wo primary hai.**

### 3.6 `server.js` double-mount + dead imports

- `:9-10` — `BookingService`, `isFirebaseActive` **unused** → delete
  (ye force karta hai `firebase-admin` init)
- `:40-43` — saare routes **4× mount**:
  ```js
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);
  app.use('/admin', adminRoutes);
  app.use('/', apiRoutes);
  ```
  → har endpoint 4 jagah publicly reachable. Dedupe: `/api` prefix rakho, root `/admin`
  hatao (legacy `public/admin.html` ke liye SPA use karo).

### 3.7 Hindi text loss in PDFs

**`services/pdfService.js:474`** — `cleanPdfText`:
```js
s.replace(/[^\x20-\x7E]/g, '')
```
Non-ASCII **delete without space** → `"श्री रमाकांत"` → `"ShriRamakant"`.

**Fix:** replace se pehle space daalo (`' '` + normalize), ya proper transliteration map.
Same issue `services/bookingService.js:380-384` ke staff-name normalization me.

### 3.8 Helpline number mismatch

| Source | Value |
|---|---|
| `data/settings.json`, `settingsService.js` | `+91 9598023701` |
| `routes/apiRoutes.js:120`, `services/pdfService.js:221,233` | `+91 7398959993` (hardcoded) |

**Fix:** hardcoded hatao, hamesha `SettingsService.getSettings()` se lo.

---

## PHASE 4 — PERFORMANCE & SIZE

### 4.1 Dead assets (~6.8 MB waste in 13.3 MB dist)

| File | Size | Verified state |
|---|---|---|
| `frontend/public/bg.jpeg` | **5,965 KB** | **100% DEAD** — zero refs in `dist/*.html,*.js,*.css`, `src/*.jsx`, `index.css` → **delete** |
| `frontend/public/vande_bharat_3d.jpg` | **837 KB** | **DEAD** — `8481faf` ka leftover, ab `vande_bharat_real.jpg` use hota hai → **delete** |
| `frontend/public/poster.png` | 3,401 KB | referenced (`App.jsx:4405, 8604, 8615`) → **compress/resize** |
| `organizer.jpg`, `icons.svg`, `src/assets/react.svg`, `vite.svg`, `hero.png`, `src/App.css` | — | verify + delete if unused |

### 4.2 `public/app/` — 28 MB, 16 stale hashed builds

Sirf `public/app/index.html` ke reference wali 1 JS+CSS pair live hai.
**Baaki 14 pairs + duplicate images delete.** (`express.static` se serve hota hai
`server.js:37`.)

### 4.3 Query performance — no pagination, full scans

Har list endpoint **poora collection** read karke JS me filter:

| Location | What |
|---|---|
| `services/bookingService.js:173` | `getBookings` — lagbhag har route |
| `services/bookingService.js:668` | checkin scan |
| `services/bookingService.js:758` | stats |
| `services/bookingService.js:79` | PNR fallback max-scan |
| `services/coachService.js:336` | composition |

**Fix (minimum):** Firestore `where` + `orderBy` jahan server-side filter ho sake;
API me `limit`/pagination.

> ⚠️ **Local shim constraint:** `config/firebase.js:210-236` sirf `==, >=, <=, in`
> support karta hai — **koi `orderBy`/`limit`/chaining nahi.**
> Agar shim target hai to **pehle shim me `orderBy`/`limit` add karo**, warna Vercel pe
> chalega aur local pe tootega.

### 4.4 PNR generation O(n)

`services/bookingService.js:79` — local shim me `runTransaction` nahi hota → max-scan
fallback. `counters` collection pe last-value store karo (shim ke `doc().set` se),
full scan avoid.

---

## PHASE 5 — CLEANUP (last, low risk)

- **Delete 15 fix scripts:**
  - Root: `append_css.js`, `fix_css.js`, `fix_css_2.js`, `fix_css_3.js`,
    `fix_css_4.js`, `fix_final.js`, `fix_strings.js`, `fix_strings_safe.js`,
    `replace.js`, `revert.js`
  - Frontend: `frontend/fix.cjs`, `fix_cancel.cjs`, `fix_portrait.cjs`,
    `fix_print_visibility.cjs`, `fix_seat.cjs`, `fix_missing_icons.js`
- **Delete `uploads/`** (empty + unreferenced — `adminRoutes.js:15` `os.tmpdir()` use karta hai)
- **`data/` tracked:** `data/db.json` git-tracked hai → local-fallback mode me **PII
  contain karega**. `.gitignore` me daalo (`data/db.json`, `data/sessions.json`);
  `data/settings.json` decision.
- **`test_*.pdf`** root me 7 files (already gitignored) → delete
- **Unused imports:** `adminRoutes.js:6` bcrypt (Phase 2.5 ke baad use ho jaayega),
  `server.js:9-10`
- **Lint warnings** 61 → reduce (`App.jsx:475-480`, `:915`, `:1159` unused vars, etc.)
  — target 0 errors, warnings best-effort

---

## ✅ FINAL VERIFICATION

### Static
```bash
# Syntax
node --check server.js
node --check routes/apiRoutes.js && node --check routes/adminRoutes.js
node --check services/authService.js && node --check services/staffService.js

# Lint + Build
npm --prefix frontend run lint      # must be 0 errors
npm run build                       # must succeed

# Security greps (expect 0 each)
Select-String -Path services\*.js,routes\*.js -Pattern "mvd_admin_token|mvd_tte_session_token|admin@mvd2026"
Select-String -Path services\authService.js -Pattern "isSigValid \|\|"
Select-String -Path frontend\src\App.jsx -Pattern "mvd_admin_token"
Select-String -Path routes\apiRoutes.js -Pattern "requireAuth"

# Cleanup (expect 0 after Phase 5)
git ls-files | Select-String "fix_|append_css|replace\.js|revert\.js"

# Dead asset (expect False after 4.1)
Test-Path frontend\public\bg.jpeg

# Build freshness
# dist\index.html mtime > src\App.jsx mtime
```

### Runtime smoke test
```bash
npm start   # port 3000
```

| # | Check | Expect |
|---|---|---|
| 1 | `GET /api/config` | 200 (public) |
| 2 | `GET /api/admin/online-transactions` (no token) | **401** |
| 3 | `GET /api/admin/coaches` (no token) | **401** |
| 4 | `PUT /api/admin/transactions/verify-utr` (no token) | **401** |
| 5 | `GET /api/admin/bookings` (no token) | **401** |
| 6 | `POST /api/auth/login` + token → `GET /api/admin/bookings` | 200 |
| 7 | Forged `jwt.<base64 {"user":{"role":"SuperAdmin"}}>.deadbeef` → protected route | **401** |
| 8 | `GET /api/admin/reports/defaulters` (with token) | **200 PDF, not 500** |
| 9 | `PUT /api/admin/bookings/:id/payment` (with token) | **200, not MODULE_NOT_FOUND** |
| 10 | Ticket print preview | content visible, `.no-print` toolbars absent |
| 11 | Receipt print preview | **A4-half (210×148mm)**, not full A4 |
| 12 | Booking → Cancel dialog | default refund = advance, charges = 0 |
| 13 | `frontend/dist` mtime > `src/App.jsx` mtime | build fresh |

---

## 📌 PRIORITY / DEPENDENCY

```
Phase 1  →  HEAD pe broken print + galat cancel default hai → pehle saaf karo
Phase 2  →  CRITICAL. 2.1 alone production khol deta hai.
            2.2 + 2.3 SAATH ME karo (alag-alag kia to login tootega)
Phase 3  →  3.1 aur 3.2 prod me 500 hain (3.2 sirf Linux pe dikhega)
Phase 4  →  dist 13.3 MB → ~6.5 MB
Phase 5  →  last
```

### Sabse pehle karo
**Phase 1.1–1.4 + Phase 2.1** — yeh 5 cheezein instant impact hain.

### Sabse bada risk
Phase 2 (security) ke baad:
- purane login sessions invalidate honge → users dobara login karenge (**expected**)
- anonymous fallbacks 401 denge → frontend ko 401 pe login redirect karna chahiye
  (agar na kare to woh alag fix hai — note kar lo)
