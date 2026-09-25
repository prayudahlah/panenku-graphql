# 12 — Relasi dan Nested Resolver

## Apa itu
GraphQL memungkinkan sebuah field bertipe objek lain (relasi), dan resolver
khusus untuk field itu. Contoh: `Product.unit` bertipe `Unit`, `Product.category`
bertipe `Category`. Field ini bersifat **additive** (lapisan showcase) — field
datar (`unitName`, `categoryName`) tetap ada untuk paritas REST.

## Tujuan
- Menunjukkan kekuatan GraphQL: client memilih bentuk relasi tanpa endpoint khusus.
- Memisahkan pengambilan relasi dari pengambilan induk (dasar munculnya N+1,
  solusinya di `13`).

## Ilustrasi (ASCII)
```
query { products { rows { id
                          unit { id name }        <-- resolver terpisah
                          category { id name }    <-- resolver terpisah
                    } } }

Eksekusi:
  products(rows: [ {unitId:4, categoryId:18}, {unitId:1, categoryId:32}, ... ])
        |
        +--> Product.unit(parent.unitId)     -> load unit 4, 1, ...
        +--> Product.category(parent.categoryId) -> load category 18, 32, ...
```

Tipe terkait:
```
type Product { ... unit: Unit   category: Category }
type Unit     { id: Int!  name: String! }
type Category { id: Int!  name: String! }
```

## File implementasi
- `backend/src/graphql/typeDefs.ts` — tipe `Unit`, `Category`, dan field
  `Product.unit` / `Product.category`.
- `backend/src/graphql/resolvers.ts` — resolver `Product.unit` & `Product.category`.
- `backend/src/graphql/loaders.ts` — pengambilan batch (lihat `13`).

## Cara membuktikan

### UI (utama)
1. Buka GraphiQL, jalankan:
```graphql
{
  products(limit: 3) {
    rows {
      id
      name
      unitName          # field datar (paritas REST)
      unit { id name }  # field relasi (nested)
      category { id name }
    }
  }
}
```
2. Perhatikan `unitName` dan `unit.name` bernilai sama — membuktikan relasi
   konsisten, tetapi bentuk nested memberi struktur yang lebih kaya.

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ products(limit:3){ rows { id unit { name } category { name } } } }"}'
```
