# 13 — N+1 dan DataLoader

## Apa itu
- **N+1 problem**: mengambil 1 list (N item) lalu untuk tiap item mengambil
  relasinya satu per satu → total 1 + N query.
- **DataLoader**: utilitas yang mengumpulkan semua permintaan relasi dalam satu
  *tick*, menggabungkannya menjadi satu query `IN (...)`, lalu memetakan hasilnya.
  Ia juga men-*cache* (dedup) key dalam satu request.

## Tujuan
- Menjaga performa saat field relasi (nested) diminta untuk banyak baris.
- Tetap mendukung skema nested tanpa membebani database.

## Ilustrasi (ASCII)
```
TANPA DataLoader (N+1)                 DENGAN DataLoader (batched)
----------------------                 ---------------------------
1 query: SELECT products (50)          1 query: SELECT products (50)
50 query: SELECT unit WHERE id=..      1 query: SELECT unit WHERE id IN (..)
50 query: SELECT cat  WHERE id=..      1 query: SELECT cat  WHERE id IN (..)
-------------                          -------------
total ~101 query                       total ~3 query
```

DataLoader hidup **per-request** (dibuat di `context`), sehingga cache-nya tidak
bocor antar request.

## File implementasi
- `backend/src/graphql/loaders.ts` — `createLoaders()` membuat `unitLoader` &
  `categoryLoader` (batch `IN (...)`). Debug via env `GRAPHQL_DEBUG_LOADERS=true`.
- `backend/src/graphql/context.ts` — `loaders: createLoaders()` per request.
- `backend/src/graphql/resolvers.ts` — `Product.unit` / `Product.category`
  memanggil `ctx.loaders.*.load(id)`.

## Cara membuktikan

### UI (utama) + log server
1. Aktifkan log batch dengan menambahkan `GRAPHQL_DEBUG_LOADERS=true` pada
   `.env.local` (dibaca service `backend` di compose), lalu restart backend:
   ```bash
   ./scripts/panenku.sh dev up
   # atau restart service backend saja via docker compose
   ```
   Alternatif: set env tersebut pada service `backend` di `compose/compose.yml`.

   Catatan: menjalankan backend manual di host tidak disarankan karena
   `DATABASE_URL` di `.env.local` memakai host `postgres` (nama service compose)
   yang tidak resolve dari host.
2. Di GraphiQL jalankan query nested untuk banyak baris:
```graphql
{
  products(limit: 50, sortBy: "name") {
    rows { id unit { name } category { name } }
  }
}
```
3. Lihat **log server** dengan `./scripts/panenku.sh dev logs` (atau
   `docker compose -f compose/compose.yml logs -f backend`). Akan tampil:
```
[dataloader] unit batch diterima 2 key (1 query IN (...))
[dataloader] category batch diterima 7 key (1 query IN (...))
```
   Artinya 50 baris dikumpulkan menjadi **2 query batch + 1 query list = 3 query**,
   bukan ~101.

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(limit:50, sortBy:\"name\"){ rows { id unit { name } category { name } } } }"}' >/dev/null
# lalu lihat log backend
```
Catatan: jumlah key = jumlah **nilai unik** (dedup), bukan jumlah baris.
