# 08 — Otorisasi per Field

## Apa itu
**Otorisasi** = menentukan *boleh apa* user yang sudah terautentikasi. GraphQL
tidak punya otorisasi bawaan, jadi setiap resolver memeriksa sendiri
(**authz per-field**).

## Tujuan
- Field tertentu hanya bisa diakses role tertentu (mis. `adminProducts` hanya admin).
- Konsisten dengan aturan REST lama (termasuk kuirk-nya).

## Ilustrasi (ASCII)
```
                        +---------------------------+
request + context  ---> | guard di resolver         |
                        |  if (!userId) -> 401      |
                        |  if (role) -> 403         |
                        +---------------------------+
                             |            |
                     tidak lolos      lolos
                             v            v
                      throw error    panggil service
```

Aturan yang berlaku:
```
Mutation.createProduct / updateProduct / takedownProduct
    butuh login (userId) -> jika tidak: 401 ERR-LOG-01
    (validasi seller/aktif tetap di service)

Query.adminProducts
    role harus "admin" -> selain itu: 403 "Akses ditolak"
    KUIRK: "super_admin" DITOLAK (meniru perilaku REST apa adanya)
```

## File implementasi
- `backend/src/graphql/resolvers.ts` — guard di `Query.adminProducts` dan tiap `Mutation`.
- `backend/src/graphql/errors.ts` — helper `unauthenticated()` (401) & `forbidden()` (403).
- `backend/src/services/catalog.ts` — validasi seller aktif (dipakai mutation).

## Cara membuktikan

### UI (utama)
1. **Tanpa login** di GraphiQL, jalankan:
```graphql
{ adminProducts(sellerId: 1) { id name } }
```
   Hasil: error `"Akses ditolak"` dengan `extensions.status: 403`.
2. **Tanpa login**, mutation:
```graphql
mutation { takedownProduct(id: 1) { id } }
```
   Hasil: error `"User belum login"` dengan `extensions.code: ERR-LOG-01`, status 401.
3. **Setelah login sebagai admin** (lihat `07`), jalankan kembali `adminProducts(sellerId: 1)`.
   Sekarang berhasil dan mengembalikan daftar produk seller tersebut.
4. Untuk membandingkan role, login sebagai **akun non-admin** (mis. buyer hasil
   `POST /auth/register` atau seller hasil registrasi di `00-index.md`) lalu
   ulangi `adminProducts` — akan kembali 403.

### Terminal (fallback)
```bash
# tanpa sesi -> 403
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ adminProducts(sellerId:1){ id } }"}'

# dengan sesi admin
curl -s -b /tmp/opencode/panenku-cookies.txt -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ adminProducts(sellerId:1){ id name } }"}'
```
