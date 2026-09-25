# 09 — Error Handling (GraphQLError + extensions)

## Apa itu
GraphQL tidak memakai HTTP status untuk error domain. Error muncul di array
`errors` pada body, dan metadata bisa ditaruh di **`extensions`**. Di Panenku,
error `ServiceResult` lama dipetakan menjadi `GraphQLError` dengan
`extensions.{code,status}`.

## Tujuan
- Mempertahankan `errorCode` khas REST (mis. `ERR-PROD-03`) agar frontend tidak
  perlu mengubah cara membaca error.
- Memberi pesan yang bisa dibaca manusia sekaligus kode mesin.

## Ilustrasi (ASCII)
```
ServiceResult (dari service lama)          GraphQLError (GraphQL)
---------------------------------          ----------------------------
{ error: "Nama produk minimal 3 karakter", |
  code:  "ERR-PROD-03",                    |  message:  "Nama produk minimal 3 karakter"
  status: 422 }                            |  extensions: { code: "ERR-PROD-03", status: 422 }
                                           |
                                           v
                          { "errors": [ { "message": "...",
                                          "extensions": { "code": "...", "status": ... } } ],
                            "data": { "createProduct": null } }
```

Bentuk error standar:
```json
{
  "errors": [
    {
      "message": "Nama produk minimal 3 karakter",
      "extensions": { "code": "ERR-PROD-03", "status": 422 }
    }
  ],
  "data": { "createProduct": null }
}
```

## File implementasi
- `backend/src/graphql/errors.ts` — `toGraphQLError`, `unauthenticated`, `forbidden`.
- `backend/src/graphql/resolvers.ts` — `if (result.error) throw toGraphQLError(result)`.
- Service tetap mengembalikan `{ error, code, status }` (tidak berubah).

## Prinsip
Gaya idiomatik GraphQL adalah **throw** error, bukan mengembalikan union
`{ error } | { data }`. Karena itu resolver melempar `GraphQLError`.

## Cara membuktikan

### UI (utama)
1. Login lewat Swagger sebagai **seller** (lihat prasyarat registrasi seller di
   `00-index.md`) agar melewati guard 401 sekaligus validasi seller.
2. Di GraphiQL, jalankan mutation dengan nama terlalu pendek:
```graphql
mutation {
  createProduct(input: {
    name: "X"
    categoryId: 1
    description: "deskripsi"
    unitId: 1
    minOrderQty: 1
    pricePerUnit: 1
    stockQuantity: 1
  }) { id }
}
```
3. Panel response GraphiQL menampilkan `errors` berisi `message` dan
   `extensions.code`. Untuk `name: "X"` (dicek lebih dulu), kode yang muncul
   adalah `ERR-PROD-03` (nama minimal 3 karakter) — sama seperti kode error REST.
   Catatan: bila login memakai akun **non-seller** (mis. admin), yang muncul lebih
   dulu adalah `ERR-PROD-01` karena validasi seller dijalankan sebelum validasi payload.

### Terminal (fallback)
```bash
# login sebagai seller dulu (lihat 00-index.md), lalu:
curl -s -b /tmp/opencode/panenku-cookies.txt -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { createProduct(input:{name:\"X\",categoryId:1,description:\"d\",unitId:1,minOrderQty:1,pricePerUnit:1,stockQuantity:1}){ id } }"}'
```
