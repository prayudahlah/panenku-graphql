# 16 — Persisted Query (APQ)

## Apa itu
**APQ (Automatic Persisted Queries)** adalah mekanisme di mana client mengirim
**hash** dokumen query, bukan teks query penuh. Jika server sudah punya query
untuk hash itu, ia langsung menjalankannya. Jika belum, client mengirim teks
query sekali untuk mendaftarkannya.

## Tujuan
- Mengurangi ukuran request (hemat bandwidth).
- Mengurangi permukaan serangan (server hanya menjalankan query yang dikenal).
- Cocok dengan pola GraphQL yang selalu POST dan tidak ramah cache HTTP.

## Ilustrasi (ASCII)
```
Langkah 1: client kirim hash saja
  { extensions: { persistedQuery: { version: 1, sha256Hash: "7f56..." } } }
        |
        v
  server: belum kenal -> error "PersistedQueryNotFound"

Langkah 2: client kirim query + hash
  { query: "{ __typename }",
    extensions: { persistedQuery: { version: 1, sha256Hash: "7f56..." } } }
        |
        v
  server: simpan query <-> hash  -> jawab data

Langkah 3: client kirim hash saja (lagi)
        |
        v
  server: sudah kenal -> jawab data (tanpa kirim query penuh)
```

## File implementasi
- `backend/src/index.ts` — `plugins: [ useAPQ(), ... ]`.
- Paket: `@graphql-yoga/plugin-apq` (fungsi `useAPQ`).

## Catatan demo
GraphiQL tidak mendukung APQ secara native, sehingga demonstrasi penuh
dilakukan via **terminal** (fallback). Ini pengecualian dari aturan "UI dulu".

## Cara membuktikan

### Terminal (fallback — disarankan untuk aspek ini)
```bash
Q='{ __typename }'
HASH=$(printf '%s' "$Q" | sha256sum | cut -d' ' -f1)
echo "hash=$HASH"

# 1) hash saja -> PersistedQueryNotFound
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d "{\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"$HASH\"}}}"
echo

# 2) query + hash -> terdaftar, jawab data
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"$Q\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"$HASH\"}}}"
echo

# 3) hash saja lagi -> dilayani dari cache
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d "{\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"$HASH\"}}}"
echo
```

Keluaran yang diharapkan:
```
Langkah 1 : {"errors":[{"message":"PersistedQueryNotFound", ...}]}
Langkah 2 : {"data":{"__typename":"Query"}}
Langkah 3 : {"data":{"__typename":"Query"}}
```

Catatan: store APQ bersifat **in-memory per proses**. Jika backend di-restart,
hash yang sudah terdaftar hilang, sehingga langkah 1 (`PersistedQueryNotFound`)
akan terjadi lagi saat mencoba hash-only.

### UI (bonus, bila mau)
Apollo Client (yang akan dipakai frontend) mendukung APQ secara otomatis, jadi
saat halaman frontend memakai Apollo, APQ aktif tanpa konfigurasi tambahan pada
query.
