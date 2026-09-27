import { gql } from '@apollo/client';

// Field yang dipakai ProductCard / ProductGrid / ProductDetail.
// Sengaja lengkap agar bentuk objek sama dengan respons REST lama.
export const PRODUCT_FIELDS = gql`
    fragment ProductFields on Product {
        id
        name
        description
        pricePerUnit
        unitId
        unitName
        minOrderQty
        stockQuantity
        isNegotiable
        categoryId
        categoryName
        sellerId
        farmName
        address
        cityName
        provinceName
        createdAt
    }
`;

export const PRODUCTS = gql`
    query Products(
        $search: String
        $categoryId: Int
        $minPrice: Float
        $maxPrice: Float
        $isNegotiable: Boolean
        $sortBy: String
        $sortOrder: String
        $page: Int
        $limit: Int
    ) {
        products(
            search: $search
            categoryId: $categoryId
            minPrice: $minPrice
            maxPrice: $maxPrice
            isNegotiable: $isNegotiable
            sortBy: $sortBy
            sortOrder: $sortOrder
            page: $page
            limit: $limit
        ) {
            rows {
                ...ProductFields
            }
            total
            page
            limit
            message
        }
    }
    ${PRODUCT_FIELDS}
`;

export const PRODUCT = gql`
    query Product($id: ID!) {
        product(id: $id) {
            ...ProductFields
        }
    }
    ${PRODUCT_FIELDS}
`;

// Normalisasi tipe: GraphQL mengembalikan ID sebagai string dan
// angka (Float) kadang string — samakan dengan bentuk REST lama
// agar perbandingan `user.id === product.sellerId` dan Link tetap jalan.
function toNumberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function normalizeProduct(p) {
    if (!p) return p;
    return {
        ...p,
        unitId: p.unitId === null || p.unitId === undefined ? p.unitId : toNumberOr(p.unitId, p.unitId),
        categoryId:
            p.categoryId === null || p.categoryId === undefined
                ? p.categoryId
                : toNumberOr(p.categoryId, p.categoryId),
        sellerId:
            p.sellerId === null || p.sellerId === undefined ? p.sellerId : toNumberOr(p.sellerId, p.sellerId),
        pricePerUnit:
            p.pricePerUnit === null || p.pricePerUnit === undefined
                ? p.pricePerUnit
                : toNumberOr(p.pricePerUnit, p.pricePerUnit),
        minOrderQty:
            p.minOrderQty === null || p.minOrderQty === undefined
                ? p.minOrderQty
                : toNumberOr(p.minOrderQty, p.minOrderQty),
        stockQuantity:
            p.stockQuantity === null || p.stockQuantity === undefined
                ? p.stockQuantity
                : toNumberOr(p.stockQuantity, p.stockQuantity),
    };
}

export function normalizeProductList(rows = []) {
    return (rows || []).map(normalizeProduct);
}

// Helper pesan error GraphQL dengan rasa bahasa yang sama seperti REST lama.
export function getGraphQLErrorMessage(error, fallback = 'Terjadi kesalahan jaringan') {
    const gqlError = error?.graphQLErrors?.[0];
    if (gqlError?.message) return gqlError.message;
    const networkMsg =
        error?.networkError?.message || error?.networkError?.result?.message || error?.message;
    if (typeof networkMsg === 'string' && networkMsg.length > 0) {
        if (/failed to fetch|networkerror|load failed/i.test(networkMsg)) return fallback;
        return networkMsg;
    }
    return fallback;
}
