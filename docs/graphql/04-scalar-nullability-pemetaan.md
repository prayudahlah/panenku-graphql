# 04 — Scalar, Nullability, dan Pemetaan Tipe

## Apa itu
- **Scalar** adalah tipe daun (tidak punya sub-field): `Int`, `Float`, `String`,
  `Boolean`, `ID`.
- **Nullability** ditandai `!`. `String!` berarti tidak pernah null; `String`
  berarti boleh null.
- **Pemetaan tipe**: menyesuaikan tipe data dari database/REST ke tipe GraphQL.

## Tujuan
- Kontrak tipe yang tegas sehingga client tahu field mana yang selalu ada.
- Menghindari kejutan bentuk data (mis. angka vs teks).

## Ilustrasi (ASCII)
```
Nilai di DB / REST / service        Tipe GraphQL        Hasil di JSON
-----------------------------------------------------------------------
id (bigint number)          --->    ID!            ---> "122"   (STRING)
pricePerUnit (numeric str)  --->    Float          ---> 927147  (NUMBER)
unitId (integer)            --->    Int!           ---> 4       (NUMBER)
createdAt (Date)            --->    String         ---> "2026-..T..Z" (ISO)
description (nullable)      --->    String         ---> null bila kosong
address/cityName/provinceName --->   String         ---> null di list, ada di detail
```

## File implementasi
- `backend/src/graphql/typeDefs.ts` — penandaan tipe & `!`.
- `backend/src/graphql/resolvers.ts`:
  - `Product.createdAt` / `AdminProduct.createdAt` → konversi Date ke ISO string.
  - `Product.unit/category` → field relasi (lihat `12`).
- Kolom `numeric` (harga/stok/min order) dikonversi otomatis oleh serializer
  `Float` dari string menjadi number.

## Catatan penting
- **`id` bertipe `ID` → dikembalikan sebagai string** (mis. `"122"`), bukan number.
  Di frontend, jangan membandingkan dengan `=== number`; gunakan sebagai string
  (aman untuk `Link to` dan `key`).
- Field yang hanya ada pada detail produk (`address`, `cityName`, `provinceName`)
  dibuat nullable agar tipe `Product` yang sama tetap valid untuk list.

## Cara membuktikan

### UI (utama)
1. Buka GraphiQL, jalankan:
```graphql
{
  products(limit: 1) {
    id
    name
    pricePerUnit
    minOrderQty
    stockQuantity
    unitId
    createdAt
    address
  }
}
```
2. Amati tipe nilai: `id` berupa string (`"..."`), `pricePerUnit` berupa number,
   `address` bernilai `null` pada list (karena hanya terisi di detail).
3. Ambil satu `id` dari hasil langkah 1, lalu bandingkan dengan detail:
```graphql
{ product(id: "122") { id address cityName provinceName } }
```
   (ganti `"122"` dengan `id` nyata dari langkah 1; karena `id` bertipe `ID`,
   nilainya ditulis sebagai string)

### Terminal (fallback)
```bash
# id diambil dari hasil query products; contoh memakai "122"
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ product(id:\"122\"){ id pricePerUnit address cityName } }"}'
```
