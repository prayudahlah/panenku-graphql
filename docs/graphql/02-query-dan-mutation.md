# 02 — Query dan Mutation

## Apa itu
GraphQL hanya punya **root type** sebagai pintu masuk operasi:
- **Query** — untuk membaca data (setara GET).
- **Mutation** — untuk mengubah data (setara POST/PATCH/PUT/DELETE).

Tidak ada "route" seperti REST; semuanya lewat field di kedua root ini.

## Tujuan
Memisahkan niat **baca** dan **tulis** secara eksplisit, sehingga:
- Query bisa di-cache/di-*dedupe* client.
- Mutation bisa ditangani dengan semantik perubahan (mis. refetch setelah sukses).

## Ilustrasi (ASCII)
```
REST                               GraphQL
----                               -------
GET    /products          <-->     Query  { products { ... } }
GET    /products/:id      <-->     Query  { product(id:1) { ... } }
POST   /products          <-->     Mutation { createProduct(...) { ... } }
PATCH  /products/:id      <-->     Mutation { updateProduct(...) { ... } }
PATCH  /products/:id/takedown <->  Mutation { takedownProduct(id:1) { ... } }
```

## File implementasi
- `backend/src/graphql/typeDefs.ts` — deklarasi `type Query { ... }` dan
  `type Mutation { ... }`.
- `backend/src/graphql/resolvers.ts` — objek `Query` dan `Mutation` berisi
  implementasi tiap field.

## Cara membuktikan

### UI (utama)
1. Buka GraphiQL.
2. **Query** (baca) — tempel lalu Run:
```graphql
{
  products(limit: 2) {
    total
    rows { id name pricePerUnit }
  }
}
```
3. **Mutation** (tulis, **butuh login sebagai seller** — lihat prasyarat
   registrasi seller di `00-index.md`) — tempel lalu Run:
```graphql
mutation {
  createProduct(input: {
    name: "Produk Uji GraphQL"
    categoryId: 1
    description: "Deskripsi produk uji minimal 10 karakter"
    unitId: 1
    minOrderQty: 1
    pricePerUnit: 10000
    stockQuantity: 10
  }) { id name }
}
```
Perhatikan GraphiQL memisahkan tab Query dan Mutation; mutation mengembalikan
objek produk yang baru dibuat. Bila login memakai akun **non-seller** (mis.
`admin@gmail.com`), respons justru error `ERR-PROD-01` karena validasi seller
berjalan lebih dulu.

### Terminal (fallback)
```bash
# query
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(limit:2){ total rows { id name } } }"}'
```
