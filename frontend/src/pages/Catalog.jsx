import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { ChevronDown } from 'lucide-react';
import { references } from '../services/api';
import { PRODUCTS, normalizeProductList } from '../graphql/products';
import ProductGrid from '../components/ProductGrid';

function buildPageNumbers(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

const sortOptions = [
    { value: 'createdAt_desc', label: 'Terbaru' },
    { value: 'price_asc', label: 'Harga termurah' },
    { value: 'price_desc', label: 'Harga termahal' },
    { value: 'name_asc', label: 'Nama A-Z' },
    { value: 'name_desc', label: 'Nama Z-A' },
];

export default function Catalog() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [expandedParents, setExpandedParents] = useState(new Set());

    const q = searchParams.get('q') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const minPrice = searchParams.get('minPrice') || '';
    const maxPrice = searchParams.get('maxPrice') || '';
    const sort = searchParams.get('sort') || 'createdAt_desc';
    const page = Number(searchParams.get('page')) || 1;
    const isNegotiable = searchParams.get('isNegotiable') || '';

    const [searchInput, setSearchInput] = useState(q);
    const [minInput, setMinInput] = useState(minPrice);
    const [maxInput, setMaxInput] = useState(maxPrice);
    const [negoInput, setNegoInput] = useState(isNegotiable);

    useEffect(() => {
        setSearchInput(q);
    }, [q]);

    useEffect(() => {
        setMinInput(minPrice);
        setMaxInput(maxPrice);
    }, [minPrice, maxPrice]);

    useEffect(() => {
        references.getProductCategories().then((json) => {
            if (json.success) setCategories(json.data);
        });
    }, []);

    const { parents, childrenByParent } = useMemo(() => {
        const p = categories.filter((c) => !c.parentId);
        const map = {};
        categories.forEach((c) => { if (c.parentId) (map[c.parentId] ??= []).push(c); });
        return { parents: p, childrenByParent: map };
    }, [categories]);

    useEffect(() => {
        if (categoryId) {
            const cat = categories.find((c) => c.id === Number(categoryId));
            if (cat && cat.parentId) setExpandedParents((prev) => new Set(prev).add(cat.parentId));
        }
    }, [categoryId, categories]);

    const variables = useMemo(() => {
        const [sortBy, sortOrder] = sort.split('_');
        const parsedCategoryId = Number(categoryId);
        const parsedMinPrice = Number(minPrice);
        const parsedMaxPrice = Number(maxPrice);
        return {
            // REST `q` -> GraphQL `search`
            search: q || undefined,
            categoryId: categoryId && Number.isFinite(parsedCategoryId) ? parsedCategoryId : undefined,
            minPrice: minPrice && Number.isFinite(parsedMinPrice) ? parsedMinPrice : undefined,
            maxPrice: maxPrice && Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : undefined,
            isNegotiable:
                isNegotiable === 'true' ? true : isNegotiable === 'false' ? false : undefined,
            sortBy,
            sortOrder,
            page,
            limit: 12,
        };
    }, [q, categoryId, minPrice, maxPrice, isNegotiable, sort, page]);

    const { data, loading } = useQuery(PRODUCTS, {
        variables,
        // Samakan perilaku REST lama yang selalu fetch; cache dipakai untuk back-nav cepat.
        fetchPolicy: 'cache-and-network',
        notifyOnNetworkStatusChange: true,
    });

    const productsData = normalizeProductList(data?.products?.rows);
    const meta = data?.products
        ? { total: data.products.total, page: data.products.page, limit: data.products.limit }
        : { total: 0, page, limit: 12 };

    const navigateWithParams = useCallback((updates) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (categoryId && updates.categoryId !== null && !('categoryId' in updates)) params.set('categoryId', categoryId);
        if (minPrice && updates.minPrice !== null && !('minPrice' in updates)) params.set('minPrice', minPrice);
        if (maxPrice && updates.maxPrice !== null && !('maxPrice' in updates)) params.set('maxPrice', maxPrice);
        if (isNegotiable && updates.isNegotiable !== null && !('isNegotiable' in updates)) params.set('isNegotiable', isNegotiable);
        if (sort && sort !== 'createdAt_desc' && !('sort' in updates)) params.set('sort', sort);
        Object.entries(updates).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') params.set(k, String(v)); });
        setSearchParams(params);
    }, [q, categoryId, minPrice, maxPrice, isNegotiable, sort, setSearchParams]);

    const handleSearch = (e) => {
        e.preventDefault();
        navigateWithParams({ q: searchInput || null, page: 1 });
    };

    const handleSortChange = (value) => {
        navigateWithParams({ sort: value === 'createdAt_desc' ? null : value, page: 1 });
    };

    const selectCategory = (id) => {
        navigateWithParams({ categoryId: categoryId === String(id) ? null : String(id), page: 1 });
    };

    const toggleParent = (id) => {
        setExpandedParents((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const applyPrice = () => {
        navigateWithParams({ minPrice: minInput || null, maxPrice: maxInput || null, page: 1 });
    };

    const resetFilters = () => {
        setMinInput('');
        setMaxInput('');
        setNegoInput('');
        navigateWithParams({ categoryId: null, minPrice: null, maxPrice: null, isNegotiable: null, page: 1 });
    };

    const totalPages = Math.ceil(meta.total / meta.limit);

    const goToPage = (p) => {
        navigateWithParams({ page: p });
    };

    return (
        <div className="max-w-[80%] mx-auto px-4 py-8">
            <div className="flex gap-6">
                <aside className="w-64 shrink-0 self-start sticky top-8">
                    <div className="bg-white rounded-xl border p-4 space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Kategori</h3>
                            <button
                                onClick={() => selectCategory(null)}
                                className={`w-full text-left text-sm py-1 rounded px-2 ${!categoryId ? 'bg-primary-green/10 text-primary-green font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Semua
                            </button>
                            {parents.map((parent) => (
                                <div key={parent.id}>
                                    <button
                                        onClick={() => toggleParent(parent.id)}
                                        className="flex items-center gap-1 w-full text-left text-sm font-medium py-1.5 px-2 rounded hover:bg-gray-50"
                                    >
                                        <ChevronDown
                                            size={14}
                                            className={`shrink-0 transition-transform ${expandedParents.has(parent.id) ? '' : '-rotate-90'}`}
                                        />
                                        {parent.name}
                                    </button>
                                    {expandedParents.has(parent.id) && childrenByParent[parent.id]?.map((child) => (
                                        <button
                                            key={child.id}
                                            onClick={() => selectCategory(child.id)}
                                            className={`w-full text-left text-sm py-1 rounded px-6 ${Number(categoryId) === child.id ? 'bg-primary-green/10 text-primary-green font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                            {child.name}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Rentang Harga</h3>
                            <div className="space-y-2">
                                <input
                                    type="number"
                                    value={minInput}
                                    onChange={(e) => setMinInput(e.target.value)}
                                    placeholder="Harga min"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                />
                                <input
                                    type="number"
                                    value={maxInput}
                                    onChange={(e) => setMaxInput(e.target.value)}
                                    placeholder="Harga maks"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                />
                                <button
                                    onClick={applyPrice}
                                    className="w-full px-3 py-1.5 text-sm bg-primary-green text-white rounded-lg hover:opacity-90"
                                >
                                    Terapkan
                                </button>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Bisa Negosiasi Harga?</h3>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = negoInput === 'true' ? '' : 'true';
                                        setNegoInput(next);
                                        navigateWithParams({ isNegotiable: next || null, page: 1 });
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${negoInput === 'true'
                                        ? 'bg-primary-green text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Ya
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = negoInput === 'false' ? '' : 'false';
                                        setNegoInput(next);
                                        navigateWithParams({ isNegotiable: next || null, page: 1 });
                                    }}
                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${negoInput === 'false'
                                        ? 'bg-primary-green text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Tidak
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={resetFilters}
                            className="w-full px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Reset filter
                        </button>
                    </div>
                </aside>

                <main className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                        <p className="text-sm text-gray-500">Menampilkan {meta.total} produk</p>
                        <select
                            value={sort}
                            onChange={(e) => handleSortChange(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                        >
                            {sortOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <ProductGrid
                        products={productsData}
                        loading={loading}
                        emptyMessage="Tidak ada produk yang cocok dengan pencarian Anda"
                    />

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-1 mt-8">
                            <button
                                disabled={page <= 1}
                                onClick={() => goToPage(page - 1)}
                                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50"
                            >
                                Sebelumnya
                            </button>
                            {buildPageNumbers(totalPages, page).map((p, i) =>
                                p === '...' ? (
                                    <span key={`e-${i}`} className="px-2 text-gray-400">...</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => goToPage(p)}
                                        className={`px-3 py-1.5 border rounded-lg text-sm ${p === page ? 'bg-primary-green text-white border-primary-green' : 'hover:bg-gray-50'}`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button
                                disabled={page >= totalPages}
                                onClick={() => goToPage(page + 1)}
                                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 hover:bg-gray-50"
                            >
                                Selanjutnya
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
