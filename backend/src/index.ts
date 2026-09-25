import { Elysia, ValidationError } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { betterSession } from 'elysia-better-session';
import { yoga } from '@elysia/graphql-yoga';
import { useAPQ } from '@graphql-yoga/plugin-apq';
import { upsertSessionAdapter } from './utils/session-adapter';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { createContext } from './graphql/context';
import { useSecurityLimits } from './graphql/plugins/security';
import {
    authRoutes,
    cartRoutes,
    checkoutRoutes,
    sellerRoutes,
    referenceRoutes,
    userRoutes,
    productRoutes,
    auditRoutes,
    negotiationRoutes,
    notificationRoutes,
    contractRoutes,
    dashboardRoutes,
} from './routes';

const app = new Elysia()
    .onError(({ code, error, set }) => {
        if (code === 'VALIDATION' && error instanceof ValidationError) {
            const valueErrors = error.all ?? [];
            const firstPath = valueErrors[0]?.path?.replace(/^\//, '') || '';

            const FIELD_MESSAGES: Record<string, string> = {
                email: 'Format email tidak valid',
                password: 'Password harus minimal 8 karakter, mengandung huruf besar dan angka',
                confirm_password: 'Konfirmasi password harus minimal 8 karakter',
                full_name: 'Nama lengkap harus 4–100 karakter dan hanya huruf',
                phone: 'Nomor telepon harus 10–13 digit (awalan 0 atau +62)',
                shippingAddress: 'Alamat pengiriman harus minimal 5 karakter',
                farmName: 'Nama kebun harus minimal 5 karakter',
                address: 'Alamat harus minimal 5 karakter',
                landCertificate: 'Surat tanah wajib diisi',
                productName: 'Nama produk harus minimal 3 karakter',
                quantity: 'Kuantitas minimal 1',
                priceOffer: 'Harga penawaran minimal 1',
            };

            const FIELD_ERROR_MAP: Record<string, string> = {
                email: 'ERR-REG-03',
                password: 'ERR-REG-02',
                full_name: 'ERR-REG-04',
                phone: 'ERR-REG-04',
                confirm_password: 'ERR-REG-04',
                shippingAddress: 'ERR-CHECKOUT-03',
            };

            const errorCode = FIELD_ERROR_MAP[firstPath];
            const message = FIELD_MESSAGES[firstPath] || valueErrors[0]?.message || 'Validasi gagal';

            set.status = 422;
            return {
                success: false,
                message,
                ...(errorCode && { errorCode }),
            };
        }

        const err: any = error;
        const errorMsg = typeof err === 'string' ? err : err?.message || '';
        const isTimeout =
            errorMsg.toLowerCase().includes('timeout') ||
            errorMsg.toLowerCase().includes('timed out') ||
            errorMsg.toLowerCase().includes('connection lost') ||
            err?.code === 'ETIMEDOUT' ||
            err?.code === 'ECONNRESET';

        if (isTimeout) {
            console.error(`[${code}] Timeout detected:`, errorMsg);
            set.status = 503;
            return { success: false, message: 'Waktu koneksi habis. Silakan coba lagi.', errorCode: 'ERR-TIMEOUT-01' };
        }

        console.error(`[${code}]`, error);
        set.status = 503;
        return { success: false, message: 'Layanan tidak tersedia. Silakan coba lagi.' };
    })
    .use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
    }))
    .use(swagger({
        path: '/api/v1/docs',
        scalarConfig: {
            spec: {
                url: '/api/v1/docs/json',
            },
        },
        documentation: {
            info: { title: 'Panenku API', version: '1.0.0' },
        },
    }))
    .use(
        betterSession({
            adapter: upsertSessionAdapter,
            ttl: 1000 * 60 * 60 * 24,
            cookie: {
                name: 'panenku_session',
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            },
            initialData: () => ({ userId: null, email: null, role: null }),
        })
    )
    .use(
        yoga({
            path: '/api/v1/graphql',
            graphiql: process.env.NODE_ENV !== 'production',
            typeDefs,
            resolvers,
            context: createContext,
            plugins: [
                useAPQ(),
                useSecurityLimits({ maxDepth: 10, maxComplexity: 100 }),
            ],
        })
    )
    .group('/api/v1', (api) => api
        .use(authRoutes)
        .use(cartRoutes)
        .use(checkoutRoutes)
        .use(referenceRoutes)
        .use(sellerRoutes)
        .use(userRoutes)
        .use(productRoutes)
        .use(auditRoutes)
        .use(negotiationRoutes)
        .use(notificationRoutes)
        .use(contractRoutes)
        .use(dashboardRoutes)
    )
    .listen(process.env.BACKEND_PORT || 3000);

console.log(`Panenku API running on port ${app.server?.port}`);