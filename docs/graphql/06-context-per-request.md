# 06 — Context per Request

## Apa itu
**Context** adalah objek yang dibuat **sekali per request** dan dibagikan ke
semua resolver dalam request itu. Tempat ideal menaruh hal lintas-resolver:
data sesi, koneksi, dan loader (lihat `13`).

## Tujuan
- Menyediakan data bersama tanpa global state.
- Menjadi titik autentikasi (siapa user-nya) — lihat `07`.

## Ilustrasi (ASCII)
```
      satu HTTP request
             |
             v
     +-------------------+        context = { session, loaders, ipAddress }
     | createContext()   |  ------------------------------+
     +-------------------+                                |
             |                                            v
   resolver products ---+                          (objek sama
   resolver product  ---+--- pakai context ------->  untuk SEMUA
   resolver unit     ---+                            resolver di
   resolver category ---+                            request ini)
```

Context Panenku berisi:
```
{
  session:   { userId, email, role } | null,   // dari cookie
  loaders:   { unitLoader, categoryLoader },   // DataLoader per-request
  ipAddress: "<x-forwarded-for | x-real-ip | 'unknown'>"  // untuk audit
}
```

## File implementasi
- `backend/src/graphql/context.ts` — fungsi `createContext({ request })`.
- `backend/src/index.ts` — `yoga({ context: createContext, ... })`.
- `backend/src/utils/session-adapter.ts` — sumber data sesi.

## Kenapa harus decode cookie manual?
Plugin `@elysia/graphql-yoga` mendaftarkan handler `({ request }) => yoga.fetch(request)`,
sehingga `session` milik Elysia **tidak** sampai ke resolver. Solusinya membaca
cookie `panenku_session` dari `request.headers` lalu mengambil data sesi lewat
adapter yang sama (`upsertSessionAdapter.get`). Tidak ada logika sesi yang diduplikasi.

## Cara membuktikan

### UI (utama)
Context tidak tampil langsung sebagai output; buktinya adalah **perilaku yang
bergantung sesi**:
1. Tanpa login, buka GraphiQL dan jalankan:
```graphql
mutation { createProduct(input:{ name:"X", categoryId:1, description:"cukup panjang", unitId:1, minOrderQty:1, pricePerUnit:1, stockQuantity:1 }){ id } }
```
Hasilnya error `"User belum login"` (`ERR-LOG-01`) karena `context.session = null`.
2. Login lewat Swagger (`POST /auth/login`). Bila memakai akun **non-seller**
   (mis. `admin@gmail.com`), ulangi mutation yang sama: hasilnya berubah menjadi
   `ERR-PROD-01` ("Akun bukan penjual..."). Perubahan ini membuktikan context
   sekarang berisi sesi user, sehingga validasi berlanjut dari autentikasi ke
   pengecekan seller.
3. Untuk jalur sukses penuh, login sebagai **seller** (lihat prasyarat registrasi
   seller di `00-index.md`) lalu jalankan mutation — context berisi sesi seller
   yang punya `seller_profile`, sehingga mutation berhasil.
   Perbedaan 401 → 403 → sukses inilah bukti bahwa context terisi per-request.

### Terminal (fallback)
```bash
# tanpa cookie -> ERR-LOG-01
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { createProduct(input:{name:\"X\",categoryId:1,description:\"cukup panjang\",unitId:1,minOrderQty:1,pricePerUnit:1,stockQuantity:1}){ id } }"}'
```
