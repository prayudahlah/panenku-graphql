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

// Mutasi SENGAJA tidak memakai `...ProductFields`. Resolver mengembalikan baris
// DB mentah hasil `.returning()`, jadi unitName/categoryName/farmName/address/
// cityName/provinceName bernilai null (nullable di SDL, jadi GraphQL tidak protes).
// Kalau field itu ikut diminta, Apollo akan menimpa entitas Product yang sudah
// ternormalisasi di cache dengan nilai null tersebut. Kesegaran data dijamin lewat
// refetch, jadi field minimal di bawah sudah cukup.
export const CREATE_PRODUCT = gql`
    mutation CreateProduct($input: ProductInput!) {
        createProduct(input: $input) {
            id
            name
            stockQuantity
        }
    }
`;

export const UPDATE_PRODUCT = gql`
    mutation UpdateProduct($id: ID!, $input: ProductInput!) {
        updateProduct(id: $id, input: $input) {
            id
            name
            stockQuantity
        }
    }
`;

export const TAKEDOWN_PRODUCT = gql`
    mutation TakedownProduct($id: ID!) {
        takedownProduct(id: $id) {
            id
        }
    }
`;

// adminProducts memakai type terpisah (AdminProduct) yang tidak punya
// unitName/categoryName/farmName — sesuai hasil adminService.listProductsBySeller.
export const ADMIN_PRODUCT_FIELDS = gql`
    fragment AdminProductFields on AdminProduct {
        id
        name
        pricePerUnit
        stockQuantity
        status
        createdAt
    }
`;

export const ADMIN_PRODUCTS = gql`
    query AdminProducts($sellerId: ID!) {
        adminProducts(sellerId: $sellerId) {
            ...AdminProductFields
        }
    }
    ${ADMIN_PRODUCT_FIELDS}
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
