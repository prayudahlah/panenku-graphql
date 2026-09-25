# 03 — Arguments, Input Type, dan Variables

## Apa itu
- **Arguments** — parameter pada sebuah field (mis. `products(limit: 12)`).
- **Input type** — tipe khusus (`input`) untuk mengelompokkan banyak argumen,
  dipakai pada mutation. Object type biasa tidak bisa jadi argumen.
- **Variables** — nilai argumen dikirim terpisah dari dokumen query, sehingga
  query bisa dipakai ulang dan aman dari injeksi string.

## Tujuan
- Memberi kontrol filter/pagination ke client tanpa mengubah kode server.
- Menjaga dokumen query tetap bersih dan ter-*cache* (variables tidak mengubah teks).

## Ilustrasi (ASCII)
```
query document                       variables (JSON)
+---------------------------+        +---------------------+
| query P($limit: Int,      |        | { "limit": 12,      |
|           $page: Int) {   | <----  |   "page": 1 }       |
|   products(limit:$limit,  |        +---------------------+
|            page:$page) {  |
|     rows { id }           |        Dipisah agar dokumen
|   }                       |        bisa dipakai ulang.
| }                         |
+---------------------------+

mutation pakai input type:
  createProduct(input: ProductInput!)  <-- satu objek argumen
```

## File implementasi
- `backend/src/graphql/typeDefs.ts`:
  - arguments `products(...)`: `search, categoryId, minPrice, maxPrice,
    isNegotiable, sortBy, sortOrder, page, limit` (dengan default `page: 1`, `limit: 12`).
  - `input ProductInput { ... }`.
- `backend/src/graphql/resolvers.ts`:
  - `Query.products` membaca `args` dan meneruskannya ke `catalogService.list`.
  - `Mutation.createProduct/updateProduct` menerima `args.input` dan meneruskannya
    ke service (service melakukan normalisasi/validasi seperti REST).

## Cara membuktikan

### UI (utama — Variables panel)
1. Buka GraphiQL.
2. Tempel query bernama berikut:
```graphql
query Cari($limit: Int, $page: Int, $search: String) {
  products(limit: $limit, page: $page, search: $search) {
    total
    page
    limit
    rows { id name categoryName }
  }
}
```
3. Buka panel **Variables**, isi:
```json
{ "limit": 3, "page": 1, "search": "Jagung" }
```
4. Jalankan. Ubah nilai variables lalu Run lagi untuk melihat hasil berbeda.

5. Uji **input type** pada mutation (**butuh login sebagai seller** — lihat
   prasyarat di `00-index.md`):
```graphql
mutation Buat($input: ProductInput!) {
  createProduct(input: $input) { id name pricePerUnit }
}
```
Variables:
```json
{ "input": { "name": "Produk Variabel", "categoryId": 1, "description": "Deskripsi cukup panjang", "unitId": 1, "minOrderQty": 1, "pricePerUnit": 5000, "stockQuantity": 5, "isNegotiable": true } }
```

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"query($limit:Int){ products(limit:$limit){ rows { id name } } }","variables":{"limit":2}}'
```
