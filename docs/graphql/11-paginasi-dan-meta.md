# 11 — Paginasi dan Meta

## Apa itu
**Paginasi** membatasi jumlah data per permintaan. Panenku memakai model
offset sederhana (`page` + `limit`) beserta `meta` (`total`, `page`, `limit`),
persis seperti REST lama. Field `message` mengisi pesan saat hasil kosong.

## Tujuan
- Konsisten dengan REST sehingga pemanggil lama tetap nyaman.
- Menghindari pengiriman seluruh katalog sekaligus.

## Ilustrasi (ASCII)
```
products(page: 2, limit: 3)
        |
        v
   +-------------------------------+
   | ProductPage                   |
   |  total : 312   <-- jumlah      |
   |  page  : 2                    |
   |  limit : 3                    |
   |  message: null | "Tidak ada..."|
   |  rows  : [ P4, P5, P6 ]        |
   +-------------------------------+
offset = (page - 1) * limit
```

## File implementasi
- `backend/src/graphql/typeDefs.ts` — tipe `ProductPage { rows, total, page, limit, message }`
  dan argumen `products(page, limit)`.
- `backend/src/graphql/resolvers.ts` — `Query.products` mengisi `message` saat
  `rows` kosong (`"Tidak ada produk ditemukan"`).
- `backend/src/repositories/catalog.ts` — perhitungan `offset`, `limit`, `total`.

## Cara membuktikan

### UI (utama)
1. Buka GraphiQL, jalankan:
```graphql
{
  products(page: 1, limit: 3) {
    total
    page
    limit
    message
    rows { id name }
  }
}
```
2. Ubah `page: 2` lalu Run → `rows` berbeda, `page` berubah, `total` tetap.
3. Buat hasil kosong untuk melihat `message`, mis. filter yang tidak ada:
```graphql
{ products(search: "zzz-tidak-ada", limit: 3) { total message rows { id } } }
```
   `rows` kosong dan `message` = `"Tidak ada produk ditemukan"`.

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(page:2,limit:3){ total page limit message rows { id name } } }"}'
```
