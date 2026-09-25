# Aspek GraphQL di Panenku — Index

Kumpulan dokumen per-aspek implementasi GraphQL untuk subset **Products**.
Setiap file berdiri sendiri dengan format konsisten:

1. **Apa itu** — definisi konsep.
2. **Tujuan** — kenapa dipakai.
3. **Ilustrasi (ASCII)** — gambaran sederhana.
4. **File implementasi** — lokasi kode.
5. **Cara membuktikan** — langkah UI dulu, lalu terminal sebagai fallback.

Urutan baca disarankan dari `01` (dasar) sampai `16` (lanjut).

## Peta aspek

| File | Aspek | Tingkat |
|---|---|---|
| `01-skema-sdl.md` | Schema / Type System (SDL) | Dasar |
| `02-query-dan-mutation.md` | Root types: Query vs Mutation | Dasar |
| `03-argumen-input-variabel.md` | Arguments, default, input type, variables | Dasar |
| `04-scalar-nullability-pemetaan.md` | Scalar, nullability, pemetaan tipe | Dasar |
| `05-resolver-dan-reuse-service.md` | Resolver & reuse service | Dasar |
| `06-context-per-request.md` | Context satu-per-request | Menengah |
| `07-autentikasi-session.md` | Autentikasi via cookie session | Menengah |
| `08-autorisasi-per-field.md` | Otorisasi per-field | Menengah |
| `09-error-handling.md` | Error `GraphQLError` + extensions | Menengah |
| `10-introspection-dan-graphiql.md` | Introspection & GraphiQL | Menengah |
| `11-paginasi-dan-meta.md` | Paginasi & meta | Menengah |
| `12-relasi-dan-nested-resolver.md` | Relasi & nested resolver | Lanjut |
| `13-n+1-dan-dataloader.md` | N+1 & DataLoader | Lanjut |
| `14-complexity-dan-depth-limit.md` | Complexity & depth limit | Lanjut |
| `15-rate-limiting.md` | Rate limiting endpoint | Lanjut |
| `16-persisted-query-apq.md` | Persisted query (APQ) | Lanjut |

## Prasyarat

### 1. Jalankan stack dev
```bash
./scripts/panenku.sh dev up --build
```
Perintah ini menyalakan PostgreSQL + backend + frontend + nginx. Skema database
dan seeder (termasuk user demo) otomatis terisi saat pertama kali.

### 2. URL yang dipakai (sesuaikan dengan `.env.local`)
| Keperluan | URL | Default |
|---|---|---|
| GraphiQL (UI GraphQL utama) | `http://localhost:<BACKEND_PORT>/api/v1/graphql` | `:3000` |
| Swagger REST (untuk login/set cookie) | `http://localhost:<BACKEND_PORT>/api/v1/docs` | `:3000` |
| GraphiQL via nginx (untuk demo rate limit) | `http://localhost:<NGINX_PORT>/api/v1/graphql` | sesuai `NGINX_PORT` (mis. `:80`) |

Catatan: `<BACKEND_PORT>` dan `<NGINX_PORT>` diambil dari `.env.local`
(`BACKEND_PORT`, `NGINX_PORT`). Dokumen ini memakai default di atas.

### 3. Akun & peran untuk demo
Login lewat Swagger UI (`/api/v1/docs`) memanggil `POST /auth/login` dengan akun
demo. Cookie `panenku_session` yang diset otomatis ikut terkirim saat membuka
GraphiQL pada host yang sama.

Peran akun menentukan operasi yang bisa diuji:

| Operasi | Peran yang dibutuhkan |
|---|---|
| `products`, `product` | publik (tanpa login) |
| `adminProducts` | `admin` |
| `takedownProduct` | `seller` atau `admin` |
| `createProduct`, `updateProduct` | **seller** (wajib punya `seller_profile`) |

Penting: akun demo `admin@gmail.com` **bukan seller** (tidak punya
`seller_profile`). Karena `createSellerProduct` memvalidasi seller lebih dulu,
`createProduct`/`updateProduct` dengan akun admin akan gagal `ERR-PROD-01`.
Untuk demo mutation tersebut, buat akun seller baru lewat Swagger:

1. `POST /auth/register` — membuat buyer + sesi aktif:
   ```json
   { "full_name": "Demo Seller", "email": "seller.demo@panenku.id", "phone": "0812345678", "password": "Demo1234", "confirm_password": "Demo1234" }
   ```
   Aturan DTO: `full_name` 4–100 huruf/spasi; `phone` 10–13 digit;
   `password` min 8 mengandung huruf besar + angka.

2. `POST /sellers/register` — membuat `seller_profile`, sesi otomatis jadi `seller`:
   ```json
   { "farmName": "Kebun Demo", "address": "Jl. Demo No. 1", "cityId": 1, "provinceId": 1, "landCertificate": "CERT-001" }
   ```
   `cityId`/`provinceId` valid dapat diambil dari `GET /cities` dan `GET /provinces`.

3. Buka GraphiQL (host yang sama). Session kini `seller`, sehingga
   `createProduct`/`updateProduct` bisa diuji berhasil.

## Konvensi
- Semua contoh query/mutation dapat ditempel langsung ke panel GraphiQL.
- Cara "terminal (fallback)" memakai `curl` ke endpoint `/api/v1/graphql`.
- Path kode ditulis relatif dari akar repo.
