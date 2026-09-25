# 15 — Rate Limiting Endpoint

## Apa itu
**Rate limiting** membatasi jumlah request per satuan waktu per klien (IP).
Karena GraphQL hanya punya satu endpoint, pembatasannya dilakukan di level
endpoint `/api/v1/graphql` (bukan per "route" seperti REST). Di Panenku ini
dipasang di **nginx**.

## Tujuan
- Mencegah penyalahgunaan/brute force pada endpoint GraphQL.
- Melengkapi perlindungan aplikasi (complexity/depth) dengan perlindungan jaringan.

## Ilustrasi (ASCII)
```
client --banyak request--> nginx (limit_req) --lolos--> backend GraphQL
                                |
                                +-- melebihi batas --> 429 Too Many Requests

Aturan saat ini (docker/nginx/default.conf):
  limit_req_zone $binary_remote_addr zone=graphql_zone:10m rate=10r/m;
  location /api/v1/graphql {
      limit_req zone=graphql_zone burst=5 nodelay;
      limit_req_status 429;
  }
```

Arti: rata-rata 10 request/menit per IP, dengan toleransi burst 5.

## File implementasi
- `docker/nginx/default.conf` — `limit_req_zone` (level http) + `limit_req` &
  `limit_req_status 429` pada `location /api/v1/graphql`.
- `compose/compose.yml` & `compose/compose.proxy.yml` — nginx sebagai reverse proxy.

## Penting
Rate limit hanya berlaku lewat **nginx**. Bila mengakses backend langsung
(`:3000`), tidak ada rate limit. Jadi demo harus melalui port nginx
(default `:8080`).

## Cara membuktikan

### UI (utama)
1. Pastikan stack berjalan, buka GraphiQL **lewat nginx**:
   `http://localhost:8080/api/v1/graphql`
2. Jalankan query ringan berikut berulang-ulang (mis. klik Run ~15 kali cepat):
```graphql
{ __typename }
```
3. Setelah sekitar 6 request pertama (burst 5 + 1), response berubah menjadi
   **429 Too Many Requests** (GraphiQL menampilkan error/HTTP 429).
4. Tunggu beberapa saat (jendela rate 10r/m), lalu coba lagi → kembali normal.

### Terminal (fallback)
```bash
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/v1/graphql \
    -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}')
  echo -n "$code "
done
echo
# contoh keluaran: 200 200 200 200 200 200 429 429 429 429 429 429 429 429 429
```
