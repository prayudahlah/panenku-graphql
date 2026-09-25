export const typeDefs = /* GraphQL */ `
    type Query {
        products(
            search: String
            categoryId: Int
            minPrice: Float
            maxPrice: Float
            isNegotiable: Boolean
            sortBy: String
            sortOrder: String
            page: Int = 1
            limit: Int = 12
        ): ProductPage!
        product(id: ID!): Product
        adminProducts(sellerId: ID!): [AdminProduct!]!
    }

    type Mutation {
        createProduct(input: ProductInput!): Product!
        updateProduct(id: ID!, input: ProductInput!): Product!
        takedownProduct(id: ID!): Product!
    }

    type ProductPage {
        rows: [Product!]!
        total: Int!
        page: Int!
        limit: Int!
        message: String
    }

    type Product {
        id: ID!
        name: String!
        description: String
        pricePerUnit: Float
        unitId: Int!
        unitName: String
        minOrderQty: Float
        stockQuantity: Float
        isNegotiable: Boolean!
        categoryId: Int!
        categoryName: String
        sellerId: Int!
        farmName: String
        address: String
        cityName: String
        provinceName: String
        createdAt: String
        unit: Unit
        category: Category
    }

    type Unit {
        id: Int!
        name: String!
    }

    type Category {
        id: Int!
        name: String!
    }

    type AdminProduct {
        id: ID!
        name: String!
        pricePerUnit: Float
        stockQuantity: Float
        status: String!
        createdAt: String
    }

    input ProductInput {
        name: String!
        categoryId: Int!
        description: String!
        unitId: Int!
        minOrderQty: Float!
        pricePerUnit: Float!
        stockQuantity: Float!
        isNegotiable: Boolean
    }
`;
