# 05 — Resolver dan Reuse Service

## Apa itu
**Resolver** adalah fungsi yang menghasilkan nilai untuk sebuah field. Signature:
```
field(parent, args, context, info) => value
```
- `parent` — hasil resolver field induk (untuk field root, kosong).
- `args` — argumen field.
- `context` — objek bersama per-request (lihat `06`).
- `info` — metadata query (jarang dipakai).

## Tujuan
Resolvers di Panenku **hanya memanggil service/repository yang sudah ada**, tidak
menyalin logika. Ini yang menjamin prinsip "rewrite tanpa mengubah logika".

## Ilustrasi (ASCII)
```
GraphiQL query
     |
     v
+---------------------+     +----------------------+     +------------------+
| Resolver (graphql)  | --> | catalogService.*     | --> | Drizzle + Postgres|
|  (adapter tipis)    |     | (validasi, audit)    |     |                  |
+---------------------+     +----------------------+     +------------------+
        |
        +-- TIDAK ada logika bisnis di sini.
            Validasi & soft-delete tetap di service/repo.
```

Pemetaan field root ke service:
```
Query.products          -> catalogService.list(filters)
Query.product           -> catalogService.getProductById(id)
Query.adminProducts     -> adminService.listProductsBySeller(sellerId)
Mutation.createProduct  -> catalogService.createSellerProduct(userId, input)
Mutation.updateProduct  -> catalogService.updateSellerProduct(userId, id, input)
Mutation.takedownProduct-> catalogService.deleteSellerProduct({...})
```

## File implementasi
- `backend/src/graphql/resolvers.ts` — seluruh resolver.
- `backend/src/services/catalog.ts` — logika produk (tidak diubah).
- `backend/src/services/admin.ts` — `listProductsBySeller` (tidak diubah).

## Cara membuktikan

### UI (utama — bandingkan GraphQL vs REST)
1. Buka **Swagger** `http://localhost:3000/api/v1/docs`, jalankan `GET /products`
   (mis. `limit=2`). Catat hasilnya.
2. Buka **GraphiQL**, jalankan query setara:
```graphql
{ products(limit: 2) { rows { id name pricePerUnit unitName categoryName } } }
```
3. Tunjukkan bahwa data identik dengan REST karena keduanya memanggil
   `catalogService.list` yang sama. Pada mutation, error validasi juga identik
   karena memakai service yang sama.

### Terminal (fallback)
```bash
# REST
curl -s "http://localhost:3000/api/v1/products?limit=2"
# GraphQL
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(limit:2){ rows { id name pricePerUnit } } }"}'
```
