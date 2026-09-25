# 07 — Autentikasi (Session Cookie)

## Apa itu
**Autentikasi** = menentukan *siapa* user yang mengirim request. Panenku memakai
**session berbasis cookie** (`panenku_session`, HttpOnly, SameSite=lax) — sama
seperti REST. GraphQL tidak mengubah mekanisme login; ia hanya membaca sesi yang
sama.

## Tujuan
- Endpoint GraphQL memakai identitas user yang sama dengan REST.
- Tidak perlu skema token baru; cookie yang ada dipakai ulang.

## Ilustrasi (ASCII)
```
 Login (REST)                              Request GraphQL
 ------------                              ---------------
 POST /api/v1/auth/login                   POST /api/v1/graphql
   |                                          |  Cookie: panenku_session=abc
   v                                          v
 server set cookie ------------------------> createContext()
  panenku_session=abc                         | baca cookie
                                              v
                                       upsertSessionAdapter.get("abc")
                                              |
                                              v
                                       session = { userId, email, role }
```

Alur login memakai TypeBox/Elysia seperti REST; password di-hash bcrypt.
GraphQL hanya **membaca** sesi (tidak mengubahnya).

## File implementasi
- `backend/src/graphql/context.ts` — parse cookie `panenku_session` → `upsertSessionAdapter.get()`.
- `backend/src/utils/session-adapter.ts` — adapter penyimpanan sesi (tabel `util.sessions`).
- `backend/src/index.ts` — `betterSession({ cookie: { name: 'panenku_session', ... } })`.
- `backend/src/controllers/auth.ts` — endpoint login/register (REST, tidak diubah).

## Cara membuktikan

### UI (utama)
1. Buka **Swagger** `http://localhost:3000/api/v1/docs`.
2. Jalankan `POST /auth/login`. Pilih akun sesuai operasi yang mau diuji:
   - `admin@gmail.com` (peran `admin`) → untuk menguji `adminProducts`.
   - akun **seller** (lihat prasyarat registrasi seller di `00-index.md`)
     → untuk menguji `createProduct`/`updateProduct`.
   ```json
   { "email": "admin@gmail.com", "password": "<lihat catatan tim>" }
   ```
   Response sukses dan browser menyimpan cookie `panenku_session`.
3. Buka **GraphiQL** di host yang sama (`http://localhost:3000/api/v1/graphql`).
   Cookie otomatis terkirim.
4. Jalankan operasi yang butuh login sesuai peran:
   - **admin** (baca):
     ```graphql
     { adminProducts(sellerId: 1) { id name } }
     ```
   - **seller** (tulis): lihat contoh `createProduct` di `02-query-dan-mutation.md`.
5. Bandingkan: tanpa login (lihat `06`) → `ERR-LOG-01`; setelah login sesuai
   peran → berhasil. Catatan: login sebagai admin lalu menjalankan `createProduct`
   tetap gagal `ERR-PROD-01` karena admin bukan seller.

### Terminal (fallback)
```bash
# login admin -> simpan cookie
curl -s -c /tmp/opencode/panenku-cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gmail.com","password":"<lihat catatan tim>"}'

# pakai cookie untuk operasi yang butuh login (admin -> adminProducts)
curl -s -b /tmp/opencode/panenku-cookies.txt -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ adminProducts(sellerId:1){ id name } }"}'
```
Untuk `createProduct` lewat terminal, login dulu sebagai seller (lihat
prasyarat di `00-index.md`).
