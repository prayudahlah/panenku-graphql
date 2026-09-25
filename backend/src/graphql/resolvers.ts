import { catalogService, adminService } from '../services';
import { toGraphQLError, unauthenticated, forbidden } from './errors';
import type { GraphQLContext } from './context';

function toIso(value: unknown): string | null {
    return value ? new Date(value as string | number | Date).toISOString() : null;
}

function emptyMessage(rows: unknown[]): string | null {
    return rows.length === 0 ? 'Tidak ada produk ditemukan' : null;
}

export const resolvers = {
    Query: {
        products: async (_parent: unknown, args: any) => {
            const result = await catalogService.list({
                search: args.search,
                categoryId: args.categoryId ?? undefined,
                minPrice: args.minPrice ?? undefined,
                maxPrice: args.maxPrice ?? undefined,
                isNegotiable: args.isNegotiable ?? undefined,
                sortBy: args.sortBy,
                sortOrder: args.sortOrder,
                page: args.page ?? 1,
                limit: args.limit ?? 12,
            });
            if (result.error) throw toGraphQLError(result);

            const data: any = result.data;
            return {
                rows: data.rows,
                total: data.total,
                page: data.page,
                limit: data.limit,
                message: emptyMessage(data.rows),
            };
        },

        product: async (_parent: unknown, { id }: any) => {
            const result = await catalogService.getProductById(Number(id));
            if (result.error) throw toGraphQLError(result);
            return result.data;
        },

        adminProducts: async (_parent: unknown, { sellerId }: any, ctx: GraphQLContext) => {
            if (ctx.session?.role !== 'admin') throw forbidden();
            const result = await adminService.listProductsBySeller(Number(sellerId));
            return result.data;
        },
    },

    Mutation: {
        createProduct: async (_parent: unknown, { input }: any, ctx: GraphQLContext) => {
            if (!ctx.session?.userId) throw unauthenticated();
            const result = await catalogService.createSellerProduct(Number(ctx.session.userId), input);
            if (result.error) throw toGraphQLError(result);
            return result.data;
        },

        updateProduct: async (_parent: unknown, { id, input }: any, ctx: GraphQLContext) => {
            if (!ctx.session?.userId) throw unauthenticated();
            const result = await catalogService.updateSellerProduct(
                Number(ctx.session.userId),
                Number(id),
                input
            );
            if (result.error) throw toGraphQLError(result);
            return result.data;
        },

        takedownProduct: async (_parent: unknown, { id }: any, ctx: GraphQLContext) => {
            if (!ctx.session?.userId) throw unauthenticated();
            const result = await catalogService.deleteSellerProduct({
                actorId: Number(ctx.session.userId),
                actorRole: ctx.session.role ?? undefined,
                productId: Number(id),
                ipAddress: ctx.ipAddress,
            });
            if (result.error) throw toGraphQLError(result);
            return result.data;
        },
    },

    Product: {
        createdAt: (parent: any) => toIso(parent.createdAt),
        unit: (parent: any, _args: unknown, ctx: GraphQLContext) =>
            parent.unitId ? ctx.loaders.unitLoader.load(Number(parent.unitId)) : null,
        category: (parent: any, _args: unknown, ctx: GraphQLContext) =>
            parent.categoryId ? ctx.loaders.categoryLoader.load(Number(parent.categoryId)) : null,
    },

    AdminProduct: {
        createdAt: (parent: any) => toIso(parent.createdAt),
    },
};
