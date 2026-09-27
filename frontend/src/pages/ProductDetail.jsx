import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { formatNumber, formatDecimal } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { cart, negotiations } from '../services/api';
import { PRODUCT, normalizeProduct, getGraphQLErrorMessage } from '../graphql/products';
import { Handshake, Store, MapPin, Minus, Plus, Loader, Check, AlertTriangle } from 'lucide-react';
import NegotiationModal from '../components/NegotiationModal';
import productPlaceholder from '../assets/product_placeholder.webp';

export default function ProductDetail() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const initialProduct = location.state?.product || null;

    // Query GraphQL selalu jalan agar data segar; hasil location.state dipakai
    // sebagai render instan selagi query loading (perilaku sama seperti REST lama).
    const { data, loading: queryLoading, error: queryError } = useQuery(PRODUCT, {
        variables: { id: String(id) },
        skip: !id,
        fetchPolicy: 'cache-and-network',
    });

    const fetchedProduct = data?.product ? normalizeProduct(data.product) : null;
    const product = fetchedProduct || initialProduct;
    const loading = queryLoading && !product;
    const error = product
        ? null
        : queryError
          ? getGraphQLErrorMessage(queryError, 'Produk tidak ditemukan')
          : queryLoading
            ? null
            : 'Produk tidak ditemukan';

    const [qty, setQty] = useState(1);
    const [actionMsg, setActionMsg] = useState(null);
    const [addingCart, setAddingCart] = useState(false);
    const [buying, setBuying] = useState(false);

    const [negoModal, setNegoModal] = useState(false);
    const [existingNegoId, setExistingNegoId] = useState(null);

    useEffect(() => {
        if (product) {
            setQty(Number(product.minOrderQty) || 1);
        }
    }, [product?.id]);

    useEffect(() => {
        if (!user || !product) { setExistingNegoId(null); return; }
        negotiations.list().then((json) => {
            const list = json.success ? json.data || [] : [];
            // product.id dari GraphQL berupa string (ID), samakan tipe sebelum bandingkan.
            setExistingNegoId(list.find((n) => Number(n.productId) === Number(product.id))?.id || null);
        });
    }, [product?.id, user]);

    const isOwner = user && product && Number(user.id) === Number(product.sellerId);
    const isBuyer = user?.role === 'buyer';
    const canAct = !isOwner;
    const canNego = isBuyer && !isOwner && product?.isNegotiable;

    const handleAddToCart = async () => {
        if (!canAct || !product) return;
        setActionMsg(null);
        setAddingCart(true);
        try {
            const json = await cart.addItem({
                productId: Number(product.id),
                quantity: qty,
                unitId: product.unitId,
            });
            if (json.success) {
                setActionMsg({ type: 'success', text: `${qty} ${product.unitName} ditambahkan ke keranjang` });
            } else {
                setActionMsg({ type: 'error', text: json.message || 'Gagal menambahkan ke keranjang' });
            }
        } catch {
            setActionMsg({ type: 'error', text: 'Terjadi kesalahan jaringan' });
        }
        setAddingCart(false);
    };

    const handleBuyNow = async () => {
        if (!canAct || !product) return;
        setActionMsg(null);
        setBuying(true);
        try {
            const json = await cart.addItem({
                productId: Number(product.id),
                quantity: qty,
                unitId: product.unitId,
            });
            if (json.success) {
                navigate('/cart');
            } else {
                setActionMsg({ type: 'error', text: json.message || 'Gagal memproses pembelian' });
            }
        } catch {
            setActionMsg({ type: 'error', text: 'Terjadi kesalahan jaringan' });
        }
        setBuying(false);
    };

    const handleNegoSuccess = () => {
        setNegoModal(false);
        setActionMsg({ type: 'success', text: 'Negosiasi berhasil diajukan!' });
        negotiations.list().then((json) => {
            const list = json.success ? json.data || [] : [];
            setExistingNegoId(list.find((n) => Number(n.productId) === Number(product.id))?.id || null);
        });
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="animate-pulse grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-gray-200 rounded-xl h-80" />
                        <div className="bg-gray-200 rounded-xl h-40" />
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-gray-200 rounded-xl h-64" />
                        <div className="bg-gray-200 rounded-xl h-24" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">{error || 'Produk tidak ditemukan.'}</p>
                <Link to="/catalog" className="text-primary-green underline font-medium">Kembali ke katalog</Link>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Link to="/catalog" className="text-sm text-gray-500 hover:text-primary-green inline-flex items-center gap-1">&larr; Kembali ke katalog</Link>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-4">
                    {/* Kolom Kiri */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-md overflow-hidden">
                            <img
                                src={productPlaceholder}
                                alt={product.name}
                                className="w-full h-auto object-cover"
                            />
                        </div>

                        {product.description && (
                            <div className="bg-white rounded-xl">
                                <h3 className="font-semibold text-gray-900 mb-3">Deskripsi Produk</h3>
                                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{product.description}</p>
                            </div>
                        )}

                        <div className='w-full h-px bg-gray-200' />

                        {/* Seller Profile Card */}
                        <div className="bg-white space-y-3">
                            <Link to={`/sellers/${product.sellerId}`} className="flex items-center gap-3 group">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-green to-secondary-brown-400 flex items-center justify-center shrink-0">
                                    <Store size={18} className="text-white" />
                                </div>
                                <p className="font-semibold text-gray-900 group-hover:text-primary-green transition truncate">{product.farmName}</p>
                            </Link>
                            {product.address && (
                                <p className="text-xs text-gray-400 flex items-start gap-1.5">
                                    <MapPin size={13} className="shrink-0 mt-0.5" />
                                    <span>{product.address}{product.cityName ? `, ${product.cityName}` : ''}{product.provinceName ? `, ${product.provinceName}` : ''}</span>
                                </p>
                            )}
                            <div className="flex items-center gap-3 text-xs">
                                <Link to={`/sellers/${product.sellerId}`} className="text-gray-400 hover:text-primary-green transition">
                                    Lihat toko &rarr;
                                </Link>
                                {isBuyer && !isOwner && (
                                    <span className="text-gray-300">|</span>
                                )}
                                {isBuyer && !isOwner && (
                                    <Link
                                        to={`/contracts/new?sellerId=${product.sellerId}&sellerName=${encodeURIComponent(product.farmName)}`}
                                        className="text-gray-400 hover:text-primary-green transition flex items-center gap-1"
                                    >
                                        <Handshake size={13} /> Ajukan kemitraan
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className='w-full h-px bg-gray-200' />
                    </div>

                    {/* Kolom Kanan */}
                    <div className="lg:col-span-2">
                        <div className="sticky top-24 space-y-4">
                            {/* Card Info + Aksi */}
                            <div className="bg-white rounded-md border border-gray-200 p-6 space-y-5 shadow-sm">
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
                                    <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">{product.categoryName}</span>
                                    {product.isNegotiable && (
                                        <span className="inline-block ml-2 text-xs bg-secondary-brown-100 text-secondary-brown-800 px-2.5 py-0.5 rounded-full font-medium">Bisa nego</span>
                                    )}
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-primary-green">Rp {formatNumber(product.pricePerUnit)}</span>
                                    <span className="text-sm text-gray-400">/{product.unitName}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-400">Stok</span>
                                        <p className="font-semibold text-gray-800">{formatNumber(product.stockQuantity)} {product.unitName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Min. Pembelian</span>
                                        <p className="font-semibold text-gray-800">{formatNumber(product.minOrderQty)} {product.unitName}</p>
                                    </div>
                                </div>

                                {/* Quantity Selector */}
                                <div>
                                    <label className="text-sm text-gray-500 mb-1.5 block">Jumlah</label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setQty(Math.max(Number(product.minOrderQty), parseFloat((qty - 0.1).toFixed(2))))}
                                            disabled={qty <= Number(product.minOrderQty)}
                                            className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        ><Minus size={16} /></button>
                                        <input
                                            type="number"
                                            step="any"
                                            value={qty}
                                            onChange={(e) => setQty(Math.max(Number(product.minOrderQty), Number(e.target.value) || 0))}
                                            className="w-20 text-center border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-green [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                            min={Number(product.minOrderQty)}
                                        />
                                        <button
                                            onClick={() => setQty(Math.min(Number(product.stockQuantity), parseFloat((qty + 0.1).toFixed(2))))}
                                            disabled={qty >= Number(product.stockQuantity)}
                                            className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        ><Plus size={16} /></button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{formatDecimal(qty)} {product.unitName}</p>
                                </div>

                                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                                    <span className="text-sm text-gray-500">Subtotal</span>
                                    <span className="text-lg font-bold text-gray-900">Rp {formatDecimal(qty * Number(product.pricePerUnit))}</span>
                                </div>

                                {/* Action Messages */}
                                {actionMsg && (
                                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${actionMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                                        {actionMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                                        {actionMsg.text}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {user ? (
                                    canAct ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={handleAddToCart}
                                                    disabled={addingCart}
                                                    className="py-2.5 bg-primary-green text-white rounded-lg font-medium hover:bg-primary-green/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:shadow-sm disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                                                >
                                                    {addingCart ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                                                    Keranjang
                                                </button>
                                                <button
                                                    onClick={handleBuyNow}
                                                    disabled={buying}
                                                    className="py-2.5 border border-primary-green text-primary-green rounded-lg font-medium hover:bg-green-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:shadow-sm disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                                                >
                                                    {buying ? <Loader size={16} className="animate-spin" /> : ''}
                                                    Beli Sekarang
                                                </button>
                                            </div>

                                            {canNego && (
                                                <button
                                                    onClick={() => setNegoModal(true)}
                                                    className="w-full py-2.5 border border-secondary-brown-300 text-secondary-brown rounded-lg font-medium hover:bg-secondary-brown-50 shadow-sm hover:shadow-md transition flex items-center justify-center gap-2"
                                                >
                                                    <Handshake size={16} />
                                                    {existingNegoId ? 'Lihat Negosiasi Anda' : 'Ajukan Negosiasi'}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                                            {isOwner ? 'Ini adalah produk Anda sendiri' : 'Anda tidak dapat membeli produk ini'}
                                        </div>
                                    )
                                ) : (
                                    <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                                        <Link to="/login" className="text-primary-green font-medium underline">Login</Link> untuk membeli atau nego produk ini
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <NegotiationModal
                isOpen={negoModal}
                onClose={() => setNegoModal(false)}
                product={product}
                onSuccess={handleNegoSuccess}
            />
        </>
    );
}
