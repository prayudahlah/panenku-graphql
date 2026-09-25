import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';
import { db } from '../db';
import { units, productCategories } from '../db/schema';

type RefRow = { id: number; name: string } | null;

const DEBUG = process.env.GRAPHQL_DEBUG_LOADERS === 'true';

function logBatch(label: string, size: number) {
    if (DEBUG) console.log(`[dataloader] ${label} batch diterima ${size} key (1 query IN (...))`);
}

export function createLoaders() {
    const unitLoader = new DataLoader<number, RefRow>(async (ids) => {
        logBatch('unit', ids.length);
        const rows = await db
            .select({ id: units.id, name: units.name })
            .from(units)
            .where(inArray(units.id, ids as number[]));
        const map = new Map(rows.map((r) => [r.id, r]));
        return ids.map((id) => map.get(id) ?? null);
    });

    const categoryLoader = new DataLoader<number, RefRow>(async (ids) => {
        logBatch('category', ids.length);
        const rows = await db
            .select({ id: productCategories.id, name: productCategories.name })
            .from(productCategories)
            .where(inArray(productCategories.id, ids as number[]));
        const map = new Map(rows.map((r) => [r.id, r]));
        return ids.map((id) => map.get(id) ?? null);
    });

    return { unitLoader, categoryLoader };
}

export type Loaders = ReturnType<typeof createLoaders>;
