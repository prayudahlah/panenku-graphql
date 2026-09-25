# 10 — Introspection dan GraphiQL

## Apa itu
- **Introspection** = kemampuan schema untuk "ditanyai" tentang dirinya sendiri
  (daftar tipe, field, argumen). Inilah yang memungkinkan tooling membuat
  dokumentasi otomatis.
- **GraphiQL** = IDE GraphQL bawaan GraphQL Yoga yang disajikan di endpoint,
  memakai introspection untuk explorer & autocomplete.

## Tujuan
- Dokumentasi hidup tanpa menulis manual.
- Alat uji yang nyaman (panel query, variables, docs).

## Ilustrasi (ASCII)
```
Browser  --- GET /api/v1/graphql --->  GraphiQL (HTML+JS)
                                            |
                                            | introspection query
                                            v
                                       Schema (typeDefs)
                                            |
        panel Docs  <-----------------------+ (daftar tipe & field)
        autocomplete <----------------------
```

## File implementasi
- `backend/src/index.ts` — opsi `graphiql: process.env.NODE_ENV !== 'production'`
  pada `yoga({ ... })`.
- `backend/src/graphql/typeDefs.ts` — schema yang di-introspect.

## Catatan (apa adanya)
- Saat ini yang dinonaktifkan di production adalah **GraphiQL (UI)**. **Query
  introspection sendiri belum dimatikan** di production. Bila ingin menutupnya,
  perlu plugin/konfigurasi tambahan (belum diimplementasikan).

## Cara membuktikan

### UI (utama)
1. Buka `http://localhost:3000/api/v1/graphql` di browser (mode dev) → tampil GraphiQL.
2. Klik **Docs** di sidebar untuk melihat schema hasil introspection
   (`Query`, `Mutation`, `Product`, `ProductInput`, dst).
3. Jalankan query introspection teks:
```graphql
{
  __schema {
    types { name kind }
  }
}
```

### Terminal (fallback)
```bash
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __schema { queryType { name } } }"}'
```
