# Frontend Security Audit

> Audit Date: 2026-04-03 | Risk Level: **CRITICAL**

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 3      |
| HIGH      | 5      |
| MEDIUM    | 9      |
| LOW       | 2      |
| **TOTAL** | **19** |

---

## CRITICAL Findings

### C1. Hardcoded Credentials in .env

**File:** `.env` (project root)

Test credentials committed to repository:

```
ADMIN='{email: admin@email.com, password: Rumi.123}'
CASHIER='{email: CASHIER@TEST.COM, password: Rumi-123}'
CUSTOMER='{email: customer@email.com, password: Rumi.123}'
```

**Impact:** Anyone with repo access has valid credentials.

**Fix:** Delete immediately, rotate accounts, use `.env.local` (gitignored) for local dev.

---

### C2. Auth Tokens in localStorage

**Files:** `utils/apiClient.ts`, `components/AuthContext.tsx`

`auth_token`, `refresh_token`, and user data stored in `localStorage` as plaintext. Any XSS vulnerability allows complete token theft.

**Fix:** Move to httpOnly cookies set by backend. Short-term: encrypt tokens at rest.

---

### C3. No CSRF Protection

All state-changing requests (POST/PUT/DELETE) have zero CSRF protection.

**Fix:** Backend generates CSRF token, frontend sends in `X-CSRF-Token` header. Use `SameSite=Strict` cookies.

---

## HIGH Findings

### H1. Token Refresh Race Condition

**File:** `utils/apiClient.ts` (lines 100-137)

Multiple concurrent 401 responses trigger simultaneous refresh calls with no mutex.

**Fix:** Implement refresh token queue (single in-flight refresh, other requests wait).

---

### H2. Vulnerable Dependencies

**Critical/High packages:**

- `jspdf` <=4.2.0: 9 vulnerabilities (PDF injection, XSS, DoS)
- `dompurify` <=3.3.1: Mutation-XSS, prototype pollution
- `lodash` <=4.17.23: Code injection, prototype pollution

**Fix:** `npm audit fix`. Remove `jspdf` if unused (current code uses iframe printing).

---

### H3. Tokens in URL Parameters

**Files:** `(auth)/verify-email/page.tsx`, `(auth)/delete-account/page.tsx`

Sensitive tokens in URL query params. Visible in browser history, logs, referrer headers.

**Fix:** Use POST requests with tokens in body.

---

### H4. File Upload Validation Missing — **product images DONE** (Track F, F1c)

**Files:** `utils/imageUploadRules.ts` (the rules), `components/admin/product/StagedImagePicker.tsx`
(create route, product + bundle), `components/admin/product-editor/ImageUploadPanel.tsx` +
`useImageGalleryUpload.ts` (edit route). The path this finding named,
`components/admin/product-details/ImageGallery.tsx`, no longer exists — it was rewritten to
`product-editor/` in #215.

Every product-image picker now sends `accept="image/jpeg,image/png,image/webp"` and re-checks type
**and** size in code (a dialog's "All files" escape and drag-and-drop both bypass `accept`), naming
the file it refused. The cap is **10 MB**, mirroring the server's own
`FileStorage:MaxFileSizeBytes` — not the 5 MB this finding guessed; matching the server is the
point, since the check exists to stop a round trip that answers HTTP 200 with
_"Uploaded 0 images. 1 failed."_

**Remaining:** the other uploaders — category image (`CategoryModal`), tenant logo, image-backfill
tooling — still take `image/*` with no size pre-check.

---

### H5. Session ID Uses Math.random()

**File:** `services/sessionService.ts`

`Math.random()` is not cryptographically secure. Session IDs predictable.

**Fix:** Use `crypto.randomUUID()`.

---

## MEDIUM Findings

| #   | Finding                                               | File                       |
| --- | ----------------------------------------------------- | -------------------------- |
| M1  | CSP uses `unsafe-inline` + `unsafe-eval`              | `next.config.ts`           |
| M2  | Refresh token sent in request body (loggable)         | `services/authService.ts`  |
| M3  | Incomplete logout cleanup (session ID not cleared)    | `AuthContext.tsx`          |
| M4  | Client-only route protection (no server middleware)   | `AdminAuthGuard.tsx`       |
| M5  | Console.log in production code                        | Multiple files             |
| M6  | Session expiry not server-enforced                    | `sessionService.ts`        |
| M7  | Cookie consent in localStorage, not httpOnly          | `CookieConsentContext.tsx` |
| M8  | Error messages may expose internal details            | Various error handlers     |
| M9  | No Next.js middleware.ts for server-side route guards | Missing file               |

---

## LOW Findings

| #   | Finding                                    |
| --- | ------------------------------------------ |
| L1  | QR code data displayed without validation  |
| L2  | Console debugging statements in production |

---

## Positive Findings

- No XSS via raw HTML injection (React escaping intact)
- Strong security headers (HSTS, X-Frame-Options, CSP, X-Content-Type-Options)
- Zod validation on auth forms
- Admin routes guarded by AdminAuthGuard with role checks
- Cookie consent properly implemented
- Image optimization security (SVG disabled, remote pattern whitelist)
- URL parameters properly encoded with `encodeURIComponent()`

---

## Remediation Priority

### Immediate (This Week)

1. Delete hardcoded credentials from `.env`, rotate accounts (C1)
2. Run `npm audit fix` (H2)
3. Fix session ID generation (H5)

### Before Next Release

4. Implement token refresh mutex (H1)
5. Add file upload validation (H4)
6. Move tokens to httpOnly cookies (C2) -- requires backend
7. Implement CSRF protection (C3) -- requires backend

### Next Sprint

8. Move tokens from URL params to POST body (H3)
9. Add Next.js middleware for server-side route protection (M9)
10. Fix remaining MEDIUM issues
