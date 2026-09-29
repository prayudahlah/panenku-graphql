# 15 — Rate Limiting Berbasis Cost

## Apa itu
**Rate limiting berbasis cost** membatasi penggunaan berdasarkan **biaya query**
(nilai complexity), bukan sekadar jumlah request. Setiap request memotong kuota
sebesar cost-nya; query berat lebih "mahal" daripada query ringan, dan akumulasi
banyak query juga menguras kuota.

Karena GraphQL hanya punya satu endpoint, pembatasan dilakukan di level aplikasi
(plugin GraphQL Yoga) untuk `/api/v1/graphql`, dengan kunci **per-user** bila login
dan **per-IP** bila anonim.

## Tujuan
- Menahan penyalahgunaan (spam query / query mahal berulang) secara **adil
  berdasarkan beban**, bukan hanya jumlah panggilan.
- Melengkapi **complexity limit** (yang membatasi *satu* query) dengan batas
  *akumulatif* per jangka waktu.

## Ilustrasi (ASCII)
```
key = user:<id> (login) | ip:<ip> (anonim)
budget = { remaining, resetAt }  (in-memory, window 60s, limit 300)

onExecute:
  cost = complexity(query)        # estimator sama; introspeksi = 0
  jika remaining < cost  ->  429 RATE_LIMIT_EXCEEDED
  selain itu             ->  remaining -= cost, lanjut eksekusi

normal query : cost ~10
query 30 alias products : cost ~90   ->  habis dalam ~4 request
```

Perbedaan dengan nginx: nginx menghitung **jumlah request** (per-IP); cost limit
menghitung **beban** (per-user/per-IP). Di Panenku, pembatasan GraphQL kini
sepenuhnya di **app-layer** (nginx hanya jadi reverse proxy biasa).

## File implementasi
- `backend/src/graphql/plugins/cost-rate-limit.ts` — plugin `useCostRateLimit`
  (`onExecute` menghitung cost & memotong kuota; menyisipkan `extensions.rateLimit`
  pada respons sukses; menolak `429` saat kuota habis).
- `backend/src/graphql/plugins/security.ts` — `estimator` complexity yang dipakai
  ulang (introspeksi berbiaya 0).
- `backend/src/index.ts` — `useCostRateLimit({ limit: 300, windowMs: 60000 })`.
- `docker/nginx/default.conf` — **tidak lagi** membatasi `/api/v1/graphql`
  (hanya proxy), agar cost limit menjadi mekanisme yang berlaku di semua jalur.

Nilai saat ini: **limit 300 cost per 60 detik**.

## Pemakaian di Frontend (Apollo)
- App frontend (Apollo) memanggil endpoint yang sama; kuota dihitung per-user
  (via cookie sesi) atau per-IP bila belum login.
- Saat kuota habis, respons `429` muncul sebagai error di halaman.

## Cara membuktikan

### UI (utama) — GraphiQL
1. Jalankan stack, buka GraphiQL: `http://localhost:<BACKEND_PORT>/api/v1/graphql`.
2. Jalankan query normal, lalu lihat **extensions** pada respons:
```graphql
{ products(limit: 2) { total rows { id name } } }
```
   Respons memuat `extensions.rateLimit = { cost, limit, remaining, resetAt }`
   (sisa kuota langsung terpakai).
3. Ulangi query berbiaya tinggi berikut (30 alias, cost ~90) berulang-ulang:
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
}
```
4. Setelah kuota habis, respons berisi error:
```json
{ "errors": [ { "message": "Batas penggunaan (cost) terlampaui",
                "extensions": { "code": "RATE_LIMIT_EXCEEDED", "cost": 90,
                                "limit": 300, "remaining": 0 } } ] }
```
5. Tunggu jendela 60 detik → kuota pulih otomatis.

### Terminal (fallback — sekaligus memperlihatkan header 429)
```bash
Q='{'; for i in $(seq 1 30); do Q="$Q p$i: products(limit:1){ rows { id } } "; done; Q="$Q }"
for i in $(seq 1 5); do
  curl -s -i -X POST http://localhost:3000/api/v1/graphql \
    -H 'Content-Type: application/json' -d "{\"query\":\"$Q\"}" \
    | grep -iE "^HTTP|X-RateLimit|Retry-After" | tr -d '\r'
  echo "---"
done
# setelah kuota habis: HTTP 429 + header X-RateLimit-* dan Retry-After
```

Catatan: aspek ini murni backend, sehingga didemokan lewat GraphiQL/terminal
(bukan app frontend).

## Batasan
- Store kuota **in-memory per proses**; bila backend berjalan multi-instance, kuota
  tidak dibagi (roadmap: Redis/penyimpanan bersama).
