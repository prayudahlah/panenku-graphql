import { useState, useEffect } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { formatNumber } from '../../utils/format';
import { admin } from '../../services/api';
import { ADMIN_PRODUCTS, TAKEDOWN_PRODUCT, getGraphQLErrorMessage } from '../../graphql/products';

export default function Products() {
    const apolloClient = useApolloClient();

    const [sellers, setSellers] = useState([]);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [search, setSearch] = useState('');
    const [actionError, setActionError] = useState('');

    // Daftar penjual tetap REST (`/sellers`): tidak termasuk scope migrasi GraphQL.
    const fetchSellers = () => {
        admin.listSellers().then((json) => {
            if (json.success) setSellers(json.data);
        });
    };

    const { data, loading, error, refetch } = useQuery(ADMIN_PRODUCTS, {
        variables: { sellerId: String(selectedSeller?.id ?? '') },
        skip: !selectedSeller,
        fetchPolicy: 'network-only',
    });

    const [takedownProduct, { loading: takingDown }] = useMutation(TAKEDOWN_PRODUCT);

    const products = data?.adminProducts || [];

    useEffect(() => {
        fetchSellers();
    }, []);

    const selectSeller = (seller) => {
        setActionError('');
        setSelectedSeller(seller);
    };

    // Produk yang di-takedown menjadi soft-deleted, jadi entitas Product-nya dibuang
    // dari cache supaya tidak ada salinan basi tersisa.
    const evictProduct = (id) => {
        const cacheId = apolloClient.cache.identify({ __typename: 'Product', id: String(id) });
        if (!cacheId) return;
        apolloClient.cache.evict({ id: cacheId });
        apolloClient.cache.gc();
    };

    const handleTakedown = async (productId) => {
        setActionError('');

        try {
            await takedownProduct({ variables: { id: String(productId) } });
            evictProduct(productId);
            refetch();
        } catch (err) {
            setActionError(getGraphQLErrorMessage(err, 'Gagal mengubah status produk'));
        }
    };

    // Error query ditampilkan apa adanya: `adminProducts` hanya menerima role
    // 'admin' (super_admin ditolak), jadi 403 "Akses ditolak" ikut terlihat di sini.
    const errorMessage =
        actionError || (error ? getGraphQLErrorMessage(error, 'Gagal memuat produk') : '');

    const filtered = sellers.filter(
        (s) =>
            s.fullName.toLowerCase().includes(search.toLowerCase()) ||
            s.farmName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Products</h1>

            {!selectedSeller ? (
                <>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari penjual..."
                        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green mb-4"
                    />
                    <div className="grid gap-3">
                        {filtered.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => selectSeller(s)}
                                className="text-left bg-white p-4 rounded-xl border hover:shadow-md transition"
                            >
                                <p className="font-medium">{s.farmName}</p>
                                <p className="text-sm text-gray-500">{s.fullName} — {s.productCount} produk</p>
                            </button>
                        ))}
                        {filtered.length === 0 && <p className="text-gray-400">Tidak ada penjual ditemukan</p>}
                    </div>
                </>
            ) : (
                <>
                    <button
                        onClick={() => { setSelectedSeller(null); setActionError(''); }}
                        className="text-sm text-primary-green font-medium mb-4 hover:underline"
                    >
                        ← Kembali ke daftar penjual
                    </button>
                    <h2 className="text-lg font-semibold mb-4">Produk milik: {selectedSeller.farmName}</h2>

                    {errorMessage && (
                        <p className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{errorMessage}</p>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-gray-500">ID</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Nama</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Harga</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Stok</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading && products.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center text-gray-400 py-12">Memuat...</td></tr>
                                ) : products.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center text-gray-400 py-12">Belum ada produk.</td></tr>
                                ) : products.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">{p.id}</td>
                                        <td className="px-4 py-3 font-medium">{p.name}</td>
                                        <td className="px-4 py-3">Rp {formatNumber(p.pricePerUnit)}</td>
                                        <td className="px-4 py-3">{formatNumber(p.stockQuantity)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.status === 'active' && (
                                                <button
                                                    disabled={takingDown}
                                                    onClick={() => handleTakedown(p.id)}
                                                    className="text-xs px-3 py-1 rounded font-medium bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                                                >
                                                    {takingDown ? 'Memproses...' : 'Takedown'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
