import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { ArrowLeft, CheckCircle, Edit3, ImagePlus, Package, Plus, Trash2, Upload, XCircle } from 'lucide-react';
import { references, seller } from '../services/api';
import {
    CREATE_PRODUCT,
    PRODUCT,
    PRODUCTS,
    TAKEDOWN_PRODUCT,
    UPDATE_PRODUCT,
    getGraphQLErrorMessage,
    normalizeProduct,
} from '../graphql/products';
import { formatNumber } from '../utils/format';

const PAGE_LIMIT = 10;
const MAX_STOCK = 99999999;

const emptyForm = {
    name: '',
    categoryId: '',
    description: '',
    unitId: '',
    minOrderQty: '1',
    pricePerUnit: '',
    stockQuantity: '',
    isNegotiable: false,
};

function getArrayPayload(json, key) {
    if (Array.isArray(json?.data?.[key])) return json.data[key];
    if (Array.isArray(json?.data)) return json.data;
    return [];
}

function getParentId(category) {
    return category?.parentId ?? category?.parent_id ?? category?.parentCategoryId ?? category?.parent_category_id ?? null;
}

function hasNoParent(category) {
    const parentId = getParentId(category);
    return parentId === null || parentId === undefined || parentId === '' || parentId === 0;
}

function buildCategoryGroups(categories) {
    const idSetWithChildren = new Set(
        categories
            .map((category) => getParentId(category))
            .filter((parentId) => parentId !== null && parentId !== undefined && parentId !== '')
            .map((parentId) => Number(parentId))
    );

    const parentById = new Map(categories.map((category) => [Number(category.id), category]));

    const leafCategories = categories.filter((category) => !idSetWithChildren.has(Number(category.id)));
    const rootLeaf = leafCategories.filter((category) => hasNoParent(category));
    const childLeaf = leafCategories.filter((category) => !hasNoParent(category));

    const groups = [];

    if (rootLeaf.length) {
        groups.push({
            label: 'Kategori Utama',
            options: rootLeaf.sort((a, b) => a.name.localeCompare(b.name)),
        });
    }

    const groupedByParent = childLeaf.reduce((acc, category) => {
        const parent = parentById.get(Number(getParentId(category)));
        const label = parent?.name || 'Lainnya';

        if (!acc[label]) acc[label] = [];
        acc[label].push(category);

        return acc;
    }, {});

    Object.keys(groupedByParent)
        .sort((a, b) => a.localeCompare(b))
        .forEach((label) => {
            groups.push({
                label,
                options: groupedByParent[label].sort((a, b) => a.name.localeCompare(b.name)),
            });
        });

    return groups;
}

const statusStyle = {
    tersedia: 'bg-green-50 text-green-700',
    menipis: 'bg-yellow-50 text-yellow-700',
    habis: 'bg-red-50 text-red-700',
};

const statusLabel = {
    tersedia: 'Tersedia',
    menipis: 'Menipis',
    habis: 'Habis',
};

function ProductIcon({ status }) {
    const color = status === 'habis'
        ? 'bg-red-50 text-red-600'
        : status === 'menipis'
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-green-50 text-primary-green';

    return (
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Package size={22} />
        </div>
    );
}

function Field({ label, error, children }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

export default function ProductList() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: productId } = useParams();
    const apolloClient = useApolloClient();

    const isCreateMode = location.pathname.endsWith('/create');
    const isEditMode = Boolean(productId);
    const isFormMode = isCreateMode || isEditMode;

    // `network-only` (bukan `cache-and-network`) supaya form hanya diisi satu kali
    // dari respons terbaru. Kalau cache ikut dipakai, respons kedua bisa menimpa
    // input yang mulai diketik pengguna. Perilaku ini sama dengan REST lama yang
    // selalu fetch `products.getById`.
    const {
        data: detailData,
        loading: detailLoading,
        error: detailError,
    } = useQuery(PRODUCT, {
        variables: { id: String(productId ?? '') },
        skip: !isEditMode,
        fetchPolicy: 'network-only',
    });

    const [createProduct, { loading: creating }] = useMutation(CREATE_PRODUCT);
    const [updateProduct, { loading: updating }] = useMutation(UPDATE_PRODUCT);
    const [takedownProduct, { loading: takingDown }] = useMutation(TAKEDOWN_PRODUCT);

    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({ tersedia: 0, menipis: 0, habis: 0 });
    const [meta, setMeta] = useState({ page: 1, limit: PAGE_LIMIT, total: 0 });

    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [selected, setSelected] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [apiError, setApiError] = useState('');
    const [errors, setErrors] = useState({});

    const busy = saving || creating || updating || takingDown;

    const categoryGroups = useMemo(() => buildCategoryGroups(categories), [categories]);

    const loadCatalog = async () => {
        // Daftar katalog seller tetap REST (`/sellers/catalog`): bentuk datanya
        // memakai productName/category/unit + status + summary, tidak ada padanannya
        // di SDL. Yang dimigrasikan ke GraphQL hanya getById + create/update/takedown.
        setLoading(true);
        setApiError('');

        try {
            const json = await seller.getCatalog({ page, limit: PAGE_LIMIT });

            if (json.success) {
                setData(json.data || []);
                setSummary(json.summary || { tersedia: 0, menipis: 0, habis: 0 });
                setMeta(json.meta || { page, limit: PAGE_LIMIT, total: 0 });
            } else {
                setApiError(json.message || 'Gagal memuat katalog produk');
            }
        } catch (error) {
            setApiError('Layanan tidak tersedia. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    const loadReferences = async () => {
        try {
            const [categoryJson, unitJson] = await Promise.all([
                references.getProductCategories(),
                references.getUnits(),
            ]);

            if (categoryJson.success) {
                setCategories(getArrayPayload(categoryJson, 'categories'));
            }

            if (unitJson.success) {
                setUnits(getArrayPayload(unitJson, 'units'));
            }
        } catch (error) {
            setApiError('Gagal memuat data referensi produk.');
        }
    };

    // Produk yang di-takedown menjadi soft-deleted, jadi entitas Product-nya harus
    // dibuang dari cache; kalau tidak, `product(id)` yang di-refetch akan 404
    // (ERR-CAT-01) dari cache lama.
    const evictProduct = (id) => {
        const cacheId = apolloClient.cache.identify({ __typename: 'Product', id: String(id) });
        if (!cacheId) return;
        apolloClient.cache.evict({ id: cacheId });
        apolloClient.cache.gc();
    };

    useEffect(() => {
        loadReferences();
    }, []);

    useEffect(() => {
        if (!isFormMode) {
            loadCatalog();
        }
    }, [isFormMode, page]);

    useEffect(() => {
        const detail = detailData?.product;
        if (!detail) return;

        const normalized = normalizeProduct(detail);
        setSelected(normalized);
        setErrors({});
        setForm({
            name: normalized.name || '',
            categoryId: normalized.categoryId || '',
            description: normalized.description || '',
            unitId: normalized.unitId || '',
            minOrderQty: normalized.minOrderQty || '1',
            pricePerUnit: normalized.pricePerUnit || '',
            stockQuantity: normalized.stockQuantity || '',
            isNegotiable: Boolean(normalized.isNegotiable),
        });
    }, [detailData]);

    useEffect(() => {
        if (isEditMode && detailError) {
            setApiError(getGraphQLErrorMessage(detailError, 'Gagal mengambil detail produk'));
        }
    }, [detailError, isEditMode]);

    useEffect(() => {
        if (isCreateMode) {
            setForm(emptyForm);
            setSelected(null);
            setErrors({});
            setApiError('');
        }
    }, [isCreateMode]);

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const nextErrors = {};
        const stock = Number(form.stockQuantity);
        const minOrder = Number(form.minOrderQty);
        const price = Number(form.pricePerUnit);

        if (form.name.trim().length < 3) nextErrors.name = 'Nama produk minimal 3 karakter';
        if (form.name.trim().length > 100) nextErrors.name = 'Nama produk maksimal 100 karakter';
        if (!form.categoryId) nextErrors.categoryId = 'Kategori wajib dipilih';
        if (form.description.trim().length < 10) nextErrors.description = 'Deskripsi minimal 10 karakter';
        if (form.description.trim().length > 1000) nextErrors.description = 'Deskripsi maksimal 1000 karakter';
        if (!form.unitId) nextErrors.unitId = 'Satuan wajib dipilih';

        if (form.stockQuantity === '') {
            nextErrors.stockQuantity = 'Stok wajib diisi';
        } else if (Number.isNaN(stock)) {
            nextErrors.stockQuantity = 'Stok harus berupa angka';
        } else if (stock < 0) {
            nextErrors.stockQuantity = 'Stok tidak boleh negatif';
        } else if (stock > MAX_STOCK) {
            nextErrors.stockQuantity = `Stok maksimal ${formatNumber(MAX_STOCK)}`;
        }

        if (form.minOrderQty === '' || Number.isNaN(minOrder) || minOrder <= 0) {
            nextErrors.minOrderQty = 'Minimal pembelian harus lebih dari 0';
        } else if (form.stockQuantity !== '' && !Number.isNaN(stock) && minOrder > stock) {
            nextErrors.minOrderQty = 'Minimal pembelian tidak boleh melebihi stok';
        }

        if (form.pricePerUnit === '' || Number.isNaN(price) || price <= 0) {
            nextErrors.pricePerUnit = 'Harga harus lebih dari 0';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const getPayload = () => ({
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        description: form.description.trim(),
        unitId: Number(form.unitId),
        minOrderQty: Number(form.minOrderQty),
        pricePerUnit: Number(form.pricePerUnit),
        stockQuantity: Number(form.stockQuantity),
        isNegotiable: Boolean(form.isNegotiable),
    });

    const backToList = () => {
        setForm(emptyForm);
        setSelected(null);
        setApiError('');
        setErrors({});
        navigate('/shop/products');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        const originalStock = selected?.stockQuantity;
        const newStock = Number(form.stockQuantity);
        if (isEditMode && originalStock !== undefined && originalStock !== null && newStock < Number(originalStock)) {
            if (!window.confirm('Anda akan mengurangi stok. Pastikan tidak ada pesanan aktif yang terpengaruh. Lanjutkan?')) {
                return;
            }
        }

        setSaving(true);
        setApiError('');

        try {
            // `refetchQueries` menyegarkan query PRODUCTS yang masih aktif
            // (Home / Catalog) supaya tidak menampilkan harga/stok lama.
            if (isEditMode) {
                await updateProduct({
                    variables: { id: String(productId), input: getPayload() },
                    refetchQueries: [{ query: PRODUCTS }],
                });
            } else {
                await createProduct({
                    variables: { input: getPayload() },
                    refetchQueries: [{ query: PRODUCTS }],
                });
            }

            backToList();
            setPage(1);
        } catch (error) {
            // Pesan diambil dari GraphQLError.message, isinya sama dengan
            // `message` REST (mis. "Nama produk minimal 3 karakter" / ERR-PROD-03).
            setApiError(getGraphQLErrorMessage(error, 'Layanan tidak tersedia. Silakan coba lagi.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        setSaving(true);
        setApiError('');

        try {
            await takedownProduct({
                variables: { id: String(deleteTarget.id) },
                refetchQueries: [{ query: PRODUCTS }],
            });
            evictProduct(deleteTarget.id);
            setDeleteTarget(null);
            loadCatalog();
        } catch (error) {
            setApiError(getGraphQLErrorMessage(error, 'Layanan tidak tersedia. Silakan coba lagi.'));
            setDeleteTarget(null);
        } finally {
            setSaving(false);
        }
    };

    const totalPages = Math.max(Math.ceil((meta.total || 0) / (meta.limit || PAGE_LIMIT)), 1);

    if (isFormMode) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-10">
                <button onClick={backToList} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-green mb-6">
                    <ArrowLeft size={16} /> Kembali ke katalog
                </button>

                <div className="mb-8">
                    <p className="text-xs text-gray-400 mb-2">Katalog › {isEditMode ? 'Perbarui Data Produk' : 'Tambah Produk Baru'}</p>
                    <h1 className="text-3xl font-bold text-primary-green">{isEditMode ? 'Perbarui Data Produk' : 'Tambah Produk Baru'}</h1>
                    <p className="text-secondary-brown text-sm mt-2">
                        {isEditMode ? 'Perbarui detail produk Anda dengan akurat.' : 'Lengkapi informasi produk untuk menarik pembeli.'}
                    </p>
                </div>

                {apiError && <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{apiError}</div>}

                {detailLoading && isEditMode ? (
                    <div className="bg-white rounded-xl border p-8 text-gray-400">Memuat detail produk...</div>
                ) : (
                    <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6">
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                                <h2 className="text-sm font-bold text-secondary-brown uppercase tracking-wide">Identitas Produk</h2>

                                <Field label="Nama Produk" error={errors.name}>
                                    <input
                                        value={form.name}
                                        onChange={(e) => updateForm('name', e.target.value)}
                                        className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        placeholder="Contoh: Sawi Hijau"
                                    />
                                </Field>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <Field label="Kategori" error={errors.categoryId}>
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => updateForm('categoryId', e.target.value)}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        >
                                            <option value="">Pilih kategori</option>
                                            {categoryGroups.map((group) => (
                                                <optgroup key={group.label} label={group.label}>
                                                    {group.options.map((item) => (
                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-gray-400">
                                            Pilih subkategori produk yang paling sesuai.
                                        </p>
                                    </Field>

                                    <Field label="Harga Dapat Dinegosiasikan?">
                                        <select
                                            value={form.isNegotiable ? 'true' : 'false'}
                                            onChange={(e) => updateForm('isNegotiable', e.target.value === 'true')}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        >
                                            <option value="true">Ya</option>
                                            <option value="false">Tidak</option>
                                        </select>
                                    </Field>
                                </div>

                                <Field label="Deskripsi Produk" error={errors.description}>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => updateForm('description', e.target.value)}
                                        rows={4}
                                        className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        placeholder="Tulis deskripsi singkat produk..."
                                    />
                                </Field>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                                <h2 className="text-sm font-bold text-secondary-brown uppercase tracking-wide">Commercial Details</h2>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <Field label="Satuan" error={errors.unitId}>
                                        <select
                                            value={form.unitId}
                                            onChange={(e) => updateForm('unitId', e.target.value)}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        >
                                            <option value="">Pilih satuan</option>
                                            {units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        </select>
                                    </Field>

                                    <Field label="Total Stok" error={errors.stockQuantity}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            max={MAX_STOCK}
                                            value={form.stockQuantity}
                                            onChange={(e) => updateForm('stockQuantity', e.target.value)}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                            placeholder="0"
                                        />
                                    </Field>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <Field label="Minimal Pembelian" error={errors.minOrderQty}>
                                        <input
                                            type="number"
                                            min="1"
                                            step="any"
                                            value={form.minOrderQty}
                                            onChange={(e) => updateForm('minOrderQty', e.target.value)}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                        />
                                    </Field>

                                    <Field label="Harga Jual Per Satuan" error={errors.pricePerUnit}>
                                        <input
                                            type="number"
                                            min="1"
                                            step="any"
                                            value={form.pricePerUnit}
                                            onChange={(e) => updateForm('pricePerUnit', e.target.value)}
                                            className="w-full bg-neutral-stone-container rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green"
                                            placeholder="0"
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="bg-neutral-stone-container rounded-xl p-6">
                                <h2 className="text-sm font-bold text-secondary-brown uppercase tracking-wide mb-4">Galeri Produk</h2>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl min-h-[180px] flex flex-col items-center justify-center text-center px-4">
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-primary-green mb-3">
                                        <Upload size={22} />
                                    </div>
                                    <p className="font-bold text-primary-green text-sm">Upload High-Res Photos</p>
                                    <p className="text-xs text-gray-500 mt-1">Preview saja, backend belum menyediakan upload gambar produk.</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    {[1, 2, 3, 4, 5, 6].map((item) => (
                                        <div key={item} className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                                            <ImagePlus size={16} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {isEditMode && (
                                <div className="bg-secondary-brown-100 rounded-xl p-6 text-center">
                                    <p className="text-xs uppercase font-semibold text-secondary-brown mb-5">Status Produk</p>
                                    <p className="font-bold">Status: Aktif</p>
                                    <p className="text-sm">Tersedia untuk dijual</p>
                                    <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1 mt-5 text-xs text-primary-green font-medium">
                                        <CheckCircle size={14} /> Terbit
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-2 flex justify-end gap-3 pt-4">
                            <button type="button" onClick={backToList} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
                                Batal
                            </button>
                            <button disabled={busy} type="submit" className="px-8 py-2.5 bg-primary-green text-white text-sm font-bold rounded-lg hover:bg-primary-green-800 disabled:opacity-60">
                                {busy ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Publish to Marketplace'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-primary-green">Sunting Katalog Anda</h1>
                    <p className="text-gray-500 text-sm mt-2 max-w-lg">Kelola stok, harga, dan informasi produk pertanian Anda.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex bg-white rounded-xl border px-5 py-3 gap-5 text-xs shadow-sm">
                        <span><b className="text-green-700">● {summary.tersedia || 0}</b><br />Tersedia</span>
                        <span><b className="text-yellow-700">● {summary.menipis || 0}</b><br />Menipis</span>
                        <span><b className="text-red-700">● {summary.habis || 0}</b><br />Habis</span>
                    </div>
                    <button onClick={() => navigate('/shop/products/create')} className="flex items-center gap-2 bg-primary-green text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-primary-green-800">
                        <Plus size={18} /> Tambah Produk
                    </button>
                </div>
            </div>

            {apiError && <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{apiError}</div>}

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-neutral-stone-base text-xs text-gray-500 uppercase tracking-widest">
                            <tr>
                                <th className="text-left py-4 px-6">Info Produk</th>
                                <th className="text-left py-4 px-6">Kategori</th>
                                <th className="text-left py-4 px-6">Harga Unit</th>
                                <th className="text-left py-4 px-6">Stok</th>
                                <th className="text-left py-4 px-6">Status</th>
                                <th className="text-left py-4 px-6">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center text-gray-400 py-12">Memuat...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="6" className="text-center text-gray-400 py-12">Belum ada produk.</td></tr>
                            ) : data.map((item) => (
                                <tr key={item.id} className="hover:bg-neutral-stone-base/60 transition">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <ProductIcon status={item.status} />
                                            <div>
                                                <p className="font-bold text-gray-800">{item.productName || item.name}</p>
                                                <p className="text-xs text-gray-400">ID: PRD-{item.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">{item.category}</span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap">Rp {formatNumber(item.pricePerUnit)}/{item.unit}</td>
                                    <td className={`py-4 px-6 font-bold ${item.status === 'habis' ? 'text-red-600' : item.status === 'menipis' ? 'text-yellow-700' : 'text-green-700'}`}>
                                        {formatNumber(item.stockQuantity)} {item.unit}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${statusStyle[item.status] || 'bg-gray-50 text-gray-600'}`}>
                                            ● {statusLabel[item.status] || item.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => navigate(`/shop/products/${item.id}/edit`)} className="text-secondary-brown hover:text-primary-green" title="Edit produk">
                                                <Edit3 size={18} />
                                            </button>
                                            <button onClick={() => setDeleteTarget(item)} className="text-red-500 hover:text-red-700" title="Hapus produk">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4 text-sm text-gray-500">
                    <p>Menampilkan {data.length} dari {meta.total || 0} produk</p>
                    <div className="flex items-center gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">‹</button>
                        <span className="px-3 py-1 rounded-lg bg-primary-green text-white font-bold">{page}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">›</button>
                    </div>
                </div>
            </div>

            {deleteTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full mx-auto flex items-center justify-center mb-5">
                                <Trash2 size={26} />
                            </div>
                            <h2 className="text-2xl font-bold mb-3">Hapus Produk ini?</h2>
                            <p className="text-gray-500 mb-5">Apakah Anda yakin ingin menghapus produk &quot;{deleteTarget.productName || deleteTarget.name}&quot;? Tindakan ini tidak dapat dibatalkan.</p>

                            <div className="bg-neutral-stone-base rounded-xl p-4 flex items-center gap-3 text-left mb-6">
                                <ProductIcon status={deleteTarget.status} />
                                <div>
                                    <p className="text-xs text-primary-green font-bold">ID: PRD-{deleteTarget.id}</p>
                                    <p className="font-bold">{deleteTarget.productName || deleteTarget.name}</p>
                                    <p className="text-sm text-gray-500">Stok: {formatNumber(deleteTarget.stockQuantity)} {deleteTarget.unit}</p>
                                </div>
                            </div>

                            <button disabled={busy} onClick={handleDelete} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-60">
                                {busy ? 'Menghapus...' : 'Hapus Produk'}
                            </button>
                            <button onClick={() => setDeleteTarget(null)} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold mt-3 hover:bg-gray-200">
                                Batal
                            </button>
                        </div>
                        <div className="bg-neutral-stone-base text-center text-xs text-gray-500 py-4 flex items-center justify-center gap-2">
                            <XCircle size={14} /> Aksi ini akan dicatat dalam log sistem.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
