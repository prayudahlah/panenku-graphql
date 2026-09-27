import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { Search } from 'lucide-react';
import heroBanner from '../assets/hero-banner.webp';
import { PRODUCTS, normalizeProductList } from '../graphql/products';
import ProductGrid from '../components/ProductGrid';

const Home = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const { data, loading } = useQuery(PRODUCTS, {
        variables: { limit: 8, page: 1, sortBy: 'createdAt', sortOrder: 'desc' },
    });

    const latestProducts = normalizeProductList(data?.products?.rows);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigate(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <>
            <section className="relative w-full h-[450px]">
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src={heroBanner}
                        alt="Hero Banner Panenku"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-green/70 to-primary-green/20" />
                </div>

                <div className="absolute inset-0 flex items-center pl-10 z-10">
                    <div className="text-white px-4">
                        <h1 className="text-5xl font-bold mb-4">
                            Langsung dari Tanah ke<br />Tangan Anda
                        </h1>
                        <p className="text-md max-w-2xl">
                            Transparansi penuh yang menghubungkan pembeli industri dengan petani lokal
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-full max-w-4xl px-4 z-20">
                    <div className="bg-white rounded-xl shadow-lg p-2">
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                            className="flex"
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari produk..."
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-green"
                                />
                            </div>
                            <button type="submit" className="px-6 py-2 bg-primary-green text-white font-medium rounded-r-md hover:opacity-90 transition">
                                Cari
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            <div className="h-16" />

            <section className="max-w-[80%] mx-auto px-4 pb-12">
                <h2 className="text-2xl font-bold mb-6">Produk Terbaru</h2>
                <ProductGrid products={latestProducts} loading={loading} />
            </section>
        </>
    );
};

export default Home;
