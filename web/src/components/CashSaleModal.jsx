import { useState, useEffect } from 'react';
import { useProfile } from "../hooks/useProfile";
import { X, Save, Search, ShoppingBag, Banknote, User, Building2 } from "lucide-react";
import { supabase } from "../supabase";

export default function CashSaleModal({ isOpen, onClose, onSuccess }) {
    const { profile } = useProfile();
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);

    // Branch State
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [isBranchLocked, setIsBranchLocked] = useState(false);

    // Search
    const [prodSearch, setProdSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Form
    const [customerName, setCustomerName] = useState(""); // Ad-hoc name

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            fetchBranches();
            // Reset
            setProdSearch("");
            setSelectedProduct(null);
            setCart([]);
            setCustomerName("");
        }
    }, [isOpen]);

    async function fetchProducts() {
        const { data } = await supabase.from("products").select("*").order("name");
        setProducts(data || []);
    }

    async function fetchBranches() {
        const { data } = await supabase.from("branches").select("*").order("id");
        setBranches(data || []);
    }

    // Handle Branch Locking
    useEffect(() => {
        // Only run if branches are loaded and we have a profile (or profile loading is done and acts as null if unrestricted)
        if (branches.length === 0) return;

        if (profile?.branch_id) {
            const restricted = branches.find(b => b.id === profile.branch_id);
            if (restricted) {
                setSelectedBranch(restricted);
                setIsBranchLocked(true);
            }
        } else {
            // Admin or Unrestricted
            setIsBranchLocked(false);
            // Default to first branch if none selected
            if (!selectedBranch && branches.length > 0) {
                setSelectedBranch(branches[0]);
            }
        }
    }, [profile, branches]);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        p.reference?.toLowerCase().includes(prodSearch.toLowerCase())
    );

    // Inventory
    const [branchStock, setBranchStock] = useState({});

    useEffect(() => {
        if (selectedBranch) {
            fetchBranchStock(selectedBranch.id);
        } else {
            setBranchStock({});
        }
    }, [selectedBranch]);

    async function fetchBranchStock(branchId) {
        const { data } = await supabase
            .from("branch_stock")
            .select("product_id, quantity")
            .eq("branch_id", branchId);

        if (data) {
            const stockMap = {};
            data.forEach(item => {
                stockMap[item.product_id] = item.quantity;
            });
            setBranchStock(stockMap);
        }
    }

    function addToCart() {
        if (!selectedProduct && !prodSearch) return;

        const productToAdd = selectedProduct || {
            id: null,
            name: prodSearch,
            cash_price: 0,
            reference: '-'
        };

        // Stock Check
        if (productToAdd.id && selectedBranch) {
            const currentStock = branchStock[productToAdd.id] || 0;
            // Check if already in cart
            const inCart = cart.find(i => i.id === productToAdd.id);
            const currentQty = inCart ? (parseInt(inCart.quantity) + 1) : 1;

            if (currentQty > currentStock) {
                alert(`عذراً، الكمية المتوفرة في هذا الفرع: ${currentStock}`);
                return;
            }
        }

        const existingItem = cart.find(item => item.name === productToAdd.name);
        if (existingItem) {
            alert("هذا المنتج مضاف بالفعل!");
            return;
        }

        setCart([...cart, { ...productToAdd, price: productToAdd.cash_price || 0, quantity: 1 }]);
        setSelectedProduct(null);
        setProdSearch("");
    }

    function removeFromCart(index) {
        setCart(cart.filter((_, i) => i !== index));
    }

    function updateCartItem(index, field, value) {
        const newCart = [...cart];
        const item = newCart[index];

        if (field === 'quantity') {
            const qty = parseInt(value) || 0;
            if (item.id && selectedBranch) {
                const currentStock = branchStock[item.id] || 0;
                if (qty > currentStock) {
                    alert(`عذراً، الكمية المتوفرة في هذا الفرع: ${currentStock}`);
                    return;
                }
            }
        }

        item[field] = value;
        setCart(newCart);
    }

    const totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity || 1)), 0);

    async function handleSubmit(e) {
        e.preventDefault();
        if (cart.length === 0) return alert("الرجاء إضافة منتجات للسلة");
        if (!selectedBranch) return alert("الرجاء اختيار فرع");

        setLoading(true);

        try {
            const productNames = cart.map(i => `${i.name} (${i.quantity})`).join(" + ");

            const payload = {
                sale_type: "cash",
                product_names: productNames,
                customer_id: null,
                adhoc_customer_name: customerName || "زبون نقدي",
                total_amount: totalAmount,
                paid_amount: totalAmount,
                status: "completed",
                withdrawal_day: null,
                branch_id: selectedBranch.id
            };

            const { data: saleData, error: saleError } = await supabase.from("sales").insert([payload]).select().single();
            if (saleError) throw saleError;

            // Insert Sale Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: parseInt(item.quantity),
                unit_price: parseFloat(item.price)
            }));

            const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
            if (itemsError) throw itemsError;

            onSuccess();
            onClose();
        } catch (err) {
            alert("خطأ: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-green-50">
                    <h3 className="font-bold text-xl text-green-800 flex items-center gap-2">
                        <Banknote className="text-green-600" />
                        بيع نقدي (Cash)
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-green-100 rounded-full text-green-500">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">

                    {/* [NEW] Branch Selection */}
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg text-green-700">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-green-900">فرع البيع</h4>
                                <p className="text-xs text-green-600">تسجيل البيع في هذا الفرع</p>
                            </div>
                        </div>
                        <select
                            value={selectedBranch?.id || ""}
                            disabled={isBranchLocked}
                            onChange={e => {
                                const b = branches.find(br => br.id === parseInt(e.target.value));
                                setSelectedBranch(b);
                            }}
                            className={`p-2 px-4 border rounded-lg font-bold text-green-800 outline-none focus:ring-2 focus:ring-green-500 ${isBranchLocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white border-green-200'}`}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product Search & Add */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">1. إضافة منتجات للبيع</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                {!selectedProduct ? (
                                    <>
                                        <Search className="absolute right-3 top-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="ابحث عن المنتج..."
                                            value={prodSearch}
                                            onChange={e => setProdSearch(e.target.value)}
                                            className="w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                        {prodSearch && filteredProducts.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 shadow-lg rounded-xl mt-1 max-h-60 overflow-y-auto z-10 divide-y divide-gray-50">
                                                {filteredProducts.map(p => {
                                                    const stockQty = branchStock[p.id] || 0;
                                                    const isOutOfStock = stockQty <= 0;

                                                    return (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => {
                                                                if (isOutOfStock) return alert("نفذت الكمية في هذا الفرع!");
                                                                setSelectedProduct(p);
                                                            }}
                                                            className={`p-3 cursor-pointer transition-colors flex justify-between items-center ${isOutOfStock
                                                                    ? 'bg-red-50 hover:bg-red-100 opacity-80 decoration-gray-500'
                                                                    : 'hover:bg-green-50'
                                                                }`}
                                                        >
                                                            <div>
                                                                <div className={`font-bold ${isOutOfStock ? 'text-gray-500' : 'text-gray-800'}`}>
                                                                    {p.name}
                                                                </div>
                                                                <div className="text-xs text-gray-500 font-mono">
                                                                    Ref: {p.reference || '-'}
                                                                </div>
                                                            </div>

                                                            <div className="text-left">
                                                                <div className={`text-sm font-bold ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`}>
                                                                    {p.cash_price?.toLocaleString()} د.ج
                                                                </div>
                                                                <div className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ml-auto mt-1 ${isOutOfStock
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    المخزون: {stockQty}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-3 bg-green-50/50 border border-green-200 rounded-xl flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-green-900">{selectedProduct.name}</div>
                                            <div className="text-sm text-green-600">Ref: {selectedProduct.reference}</div>
                                        </div>
                                        <button onClick={() => { setSelectedProduct(null); setProdSearch(""); }} className="text-red-500 bg-white p-1 rounded-full shadow-sm hover:shadow">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={addToCart}
                                className="bg-green-600 text-white px-4 rounded-xl font-bold hover:bg-green-700"
                            >
                                إضافة
                            </button>
                        </div>
                    </div>

                    {/* Cart Table */}
                    {cart.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-green-50 text-green-900 font-bold">
                                    <tr>
                                        <td className="p-3">المنتج</td>
                                        <td className="p-3 w-20">الكمية</td>
                                        <td className="p-3 w-32">السعر</td>
                                        <td className="p-3 w-32">الإجمالي</td>
                                        <td className="p-3 w-10"></td>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                                            <td className="p-3 font-medium">{item.name}</td>
                                            <td className="p-3">
                                                <input
                                                    type="number" min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateCartItem(idx, 'quantity', e.target.value)}
                                                    className="w-full p-1 border rounded text-center"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number" min="0"
                                                    value={item.price}
                                                    onChange={(e) => updateCartItem(idx, 'price', e.target.value)}
                                                    className="w-full p-1 border rounded text-center"
                                                />
                                            </td>
                                            <td className="p-3 font-bold text-green-700">
                                                {(item.price * item.quantity).toLocaleString()}
                                            </td>
                                            <td className="p-3">
                                                <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:text-red-700">
                                                    <X size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-green-100 font-bold text-green-900">
                                    <tr>
                                        <td colSpan="3" className="p-3 pl-6">المجموع الكلي</td>
                                        <td colSpan="2" className="p-3 text-lg">{totalAmount.toLocaleString()} د.ج</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">2. اسم المشتري (اختياري)</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl  focus:ring-2 focus:ring-green-500 outline-none"
                            placeholder="اسم الزبون..."
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading || cart.length === 0}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? "جاري الحفظ..." : `إتمام البيع (${totalAmount.toLocaleString()} د.ج)`}
                        <Save size={20} />
                    </button>

                </div>
            </div>
        </div>
    );
}
