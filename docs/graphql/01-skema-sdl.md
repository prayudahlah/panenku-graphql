# 01 — Schema / Type System (SDL)

## Apa itu
**Schema** adalah kontrak tipe antara client dan server, ditulis memakai
**SDL (Schema Definition Language)**. Ia mendefinisikan objek apa yang bisa
diminta, field-nya, tipenya, dan operasi yang tersedia.

Di Panenku, schema ditulis sebagai string pada `typeDefs`.

## Tujuan
- Menjadi **satu sumber kebenaran** bentuk data (tidak ada tebakan bentuk JSON).
- Memvalidasi query: field/argumen yang tidak dikenal ditolak sebelum resolver jalan.
- Mengaktifkan **introspection** (dokumentasi otomatis) dan tooling (GraphiQL).

## Ilustrasi (ASCII)
```
        +-------------+         +------------------+         +-----------+
client  |  query tak  |  --->   |     SCHEMA       |  --->   | RESOLVER  |
        |  terstruktur|         | (validasi tipe)  |         | (logika)  |
        +-------------+         +------------------+         +-----------+
                                      ^
                                      |
                              typeDefs.ts (kontrak)
```

Contoh potongan schema:
```graphql
type Product {
  id: ID!
  name: String!
  pricePerUnit: Float
  unit: Unit
}
```

## File implementasi
- `backend/src/graphql/typeDefs.ts` — seluruh SDL: `Query`, `Mutation`,
  `Product`, `ProductPage`, `AdminProduct`, `Unit`, `Category`, `ProductInput`.
- `backend/src/index.ts` — schema dipasang ke server via `yoga({ typeDefs, ... })`.

## Cara membuktikan

### UI (utama)
1. Jalankan stack, buka GraphiQL: `http://localhost:3000/api/v1/graphql`.
2. Klik tombol **Docs** (ikon dokumen di sidebar). Akan tampil seluruh tipe hasil
   introspection: `Query`, `Mutation`, `Product`, `Unit`, dll.
3. Di panel kiri jalankan query berikut lalu **Run**:
```graphql
{
  __schema { queryType { fields { name } } }
}
```
Hasilnya menampilkan daftar field root (`products`, `product`, `adminProducts`).

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}'
```
