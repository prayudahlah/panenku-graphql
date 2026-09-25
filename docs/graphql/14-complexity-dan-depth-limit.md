# 14 — Query Complexity dan Depth Limit

## Apa itu
Dua perlindungan terhadap query "berat" yang bisa menguras server:
- **Depth limit**: membatasi kedalaman (level nested) sebuah query.
- **Complexity/cost limit**: menghitung "biaya" query berdasarkan struktur
  (jumlah field & alias), menangkap query **lebar** yang tidak tertangkap depth.

Keduanya dipasang sebagai **validation rule** pada fase validasi GraphQL
(sebelum resolver berjalan), sehingga query ditolak lebih awal.

## Tujuan
- Mencegah DoS lewat query dalam/lebar.
- Tetap mengizinkan query wajar (ada headroom).

## Ilustrasi (ASCII)
```
Query wajar            Query abusive (alias)
-----------            ---------------------
{ products {           { p1: products { rows { id } }
    rows {             p2: products { rows { id } }
      id name          ... (50 alias) ...
    }                  p50: products { rows { id } } }
    total } }          |
                       v
complexity ~15    <--  complexity 150 --> DITOLAK (max 100)

Depth limit  : batas level nested (mis. 10)
Complexity   : batas total biaya field/alias (mis. 100)
```

Konfigurasi saat ini:
```
maxDepth      : 10
maxComplexity : 100
estimator     : simpleEstimator (1 per field)
```

## File implementasi
- `backend/src/graphql/plugins/security.ts` — plugin `useSecurityLimits` yang
  menambahkan dua validation rule (`graphql-depth-limit` + `graphql-query-complexity`).
- `backend/src/index.ts` — `plugins: [ useAPQ(), useSecurityLimits({ maxDepth: 10, maxComplexity: 100 }) ]`.

## Catatan penting
`graphql-depth-limit` **selalu mengabaikan field introspeksi** (nama berawalan `__`).
Karena itu, alat utama untuk demo adalah **complexity limit**.

## Cara membuktikan

### UI (utama)
1. Buka GraphiQL.
2. Jalankan query wajar (lolos):
```graphql
{ products(limit: 2) { total rows { id name } } }
```
3. Jalankan query abusive berikut (50 alias) → **ditolak**:
```graphql
{
  p1: products(limit:1){rows{id}} p2: products(limit:1){rows{id}} p3: products(limit:1){rows{id}}
  p4: products(limit:1){rows{id}} p5: products(limit:1){rows{id}} p6: products(limit:1){rows{id}}
  p7: products(limit:1){rows{id}} p8: products(limit:1){rows{id}} p9: products(limit:1){rows{id}}
  p10: products(limit:1){rows{id}} p11: products(limit:1){rows{id}} p12: products(limit:1){rows{id}}
  p13: products(limit:1){rows{id}} p14: products(limit:1){rows{id}} p15: products(limit:1){rows{id}}
  p16: products(limit:1){rows{id}} p17: products(limit:1){rows{id}} p18: products(limit:1){rows{id}}
  p19: products(limit:1){rows{id}} p20: products(limit:1){rows{id}} p21: products(limit:1){rows{id}}
  p22: products(limit:1){rows{id}} p23: products(limit:1){rows{id}} p24: products(limit:1){rows{id}}
  p25: products(limit:1){rows{id}} p26: products(limit:1){rows{id}} p27: products(limit:1){rows{id}}
  p28: products(limit:1){rows{id}} p29: products(limit:1){rows{id}} p30: products(limit:1){rows{id}}
  p31: products(limit:1){rows{id}} p32: products(limit:1){rows{id}} p33: products(limit:1){rows{id}}
  p34: products(limit:1){rows{id}} p35: products(limit:1){rows{id}} p36: products(limit:1){rows{id}}
  p37: products(limit:1){rows{id}} p38: products(limit:1){rows{id}} p39: products(limit:1){rows{id}}
  p40: products(limit:1){rows{id}} p41: products(limit:1){rows{id}} p42: products(limit:1){rows{id}}
  p43: products(limit:1){rows{id}} p44: products(limit:1){rows{id}} p45: products(limit:1){rows{id}}
  p46: products(limit:1){rows{id}} p47: products(limit:1){rows{id}} p48: products(limit:1){rows{id}}
  p49: products(limit:1){rows{id}} p50: products(limit:1){rows{id}}
}
```
   Panel response menampilkan pesan:
```
The query exceeds the maximum complexity of 100. Actual complexity is 150
```

### Terminal (fallback)
```bash
# bangun query 50 alias lalu kirim
Q='{'; for i in $(seq 1 50); do Q="$Q p$i: products(limit:1){ rows { id } } "; done; Q="$Q }"
curl -s -X POST http://localhost:3000/api/v1/graphql \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"$Q\"}"
```
