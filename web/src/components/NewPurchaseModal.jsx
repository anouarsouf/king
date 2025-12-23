import { useState, useEffect } from "react";
import { X, Save, Plus, Search, Trash2, ShoppingBag, PackagePlus } from "lucide-react";
import { supabase } from "../supabase";
import ProductModal from "./ProductModal";
import ProductCombobox from "./ProductCombobox";

export default function NewPurchaseModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);


    // Form State
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [items, setItems] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

    // Temporary Item State
    const [currentItem, setCurrentItem] = useState({
        product_id: "",
        product_name: "", // For display
        quantity: 1,
        unit_price: 0
    });

    useEffect(() => {
        if (isOpen) {
            fetchSuppliers();
            fetchProducts();
            // Reset form
            setItems([]);
            setSelectedSupplier("");
            setTotalAmount(0);
            setPurchaseDate(new Date().toISOString().split('T')[0]);
            setCurrentItem({ product_id: "", product_name: "", quantity: 1, unit_price: 0 });
        }
    }, [isOpen]);

    async function fetchSuppliers() {
        const { data } = await supabase.from("suppliers").select("*");
        setSuppliers(data || []);
    }

    async function fetchProducts() {
        const { data } = await supabase.from("products").select("id, name, purchase_price");
        setProducts(data || []);
    }

    const handleAddItem = () => {
        if (!currentItem.product_id || currentItem.quantity <= 0) return;

        const newItem = {
            ...currentItem,
            total: currentItem.quantity * currentItem.unit_price
        };

        const newItems = [...items, newItem];
        setItems(newItems);
        calculateTotal(newItems);

        // Reset current item
        setCurrentItem({ product_id: "", product_name: "", quantity: 1, unit_price: 0 });
    };

    const removeItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        calculateTotal(newItems);
    };

    const calculateTotal = (currentItems) => {
        const total = currentItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        setTotalAmount(total);
    };



    async function handleSubmit() {
        if (!selectedSupplier || items.length === 0) {
            return alert("يرجى اختيار مورد وإضافة منتج واحد على الأقل.");
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('register_purchase_v2', {
                p_supplier_id: selectedSupplier,
                p_total_amount: totalAmount,
                p_items: items,
                p_date: purchaseDate
            });

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (err) {
            alert("خطأ في حفظ الفاتورة: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Called when a new product is created successfully via Quick Add
    const handleProductCreated = async () => {
        await fetchProducts(); // Refresh list to get the new product
        setIsProductModalOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-purple-50">
                    <h3 className="font-bold text-xl text-purple-900 flex items-center gap-2">
                        <ShoppingBag className="text-purple-600" />
                        فاتورة شراء جديدة
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-purple-100 rounded-full text-purple-500">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Supplier Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">المورد</label>
                            <select
                                value={selectedSupplier}
                                onChange={(e) => setSelectedSupplier(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                            >
                                <option value="">اختر المورد...</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">تاريخ الفاتورة</label>
                            <input
                                type="date"
                                value={purchaseDate}
                                onChange={(e) => setPurchaseDate(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-white font-mono text-center"
                            />
                        </div>
                    </div>

                    {/* Add Items Section */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                            <Plus size={18} className="text-purple-600" />
                            إضافة منتجات للفاتورة
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-5 space-y-1">
                                <label className="text-xs font-bold text-gray-500">المنتج</label>
                                <div className="flex gap-2 items-center">
                                    <ProductCombobox
                                        products={products}
                                        selectedId={currentItem.product_id}
                                        onSelect={(id) => {
                                            const product = products.find(p => p.id == id);
                                            if (product) {
                                                setCurrentItem({
                                                    ...currentItem,
                                                    product_id: product.id,
                                                    product_name: product.name,
                                                    unit_price: product.purchase_price || 0
                                                });
                                            } else {
                                                setCurrentItem({ ...currentItem, product_id: "", product_name: "", unit_price: 0 });
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => setIsProductModalOpen(true)}
                                        className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 tooltip shrink-0"
                                        title="إضافة منتج جديد"
                                    >
                                        <PackagePlus size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-bold text-gray-500">الكمية</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={currentItem.quantity}
                                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-center"
                                />
                            </div>

                            <div className="md:col-span-3 space-y-1">
                                <label className="text-xs font-bold text-gray-500">سعر الشراء (للوحدة)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={currentItem.unit_price}
                                    onChange={(e) => setCurrentItem({ ...currentItem, unit_price: parseFloat(e.target.value) || 0 })}
                                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-center"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <button
                                    onClick={handleAddItem}
                                    disabled={!currentItem.product_id}
                                    className="w-full p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold disabled:opacity-50 transition-colors"
                                >
                                    إضافة
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    {items.length > 0 ? (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-right">
                                <thead className="bg-gray-100 text-gray-600 font-bold text-sm">
                                    <tr>
                                        <td className="p-3">المنتج</td>
                                        <td className="p-3">الكمية</td>
                                        <td className="p-3">سعر الوحدة</td>
                                        <td className="p-3">الإجمالي</td>
                                        <td className="p-3 w-10"></td>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">{item.product_name}</td>
                                            <td className="p-3">{item.quantity}</td>
                                            <td className="p-3">{item.unit_price.toLocaleString()}</td>
                                            <td className="p-3 font-bold text-purple-700">{(item.quantity * item.unit_price).toLocaleString()}</td>
                                            <td className="p-3">
                                                <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-purple-50 font-bold text-purple-900 border-t border-purple-100">
                                    <tr>
                                        <td colSpan="3" className="p-4 text-left pl-8">المجموع الكلي:</td>
                                        <td colSpan="2" className="p-4 text-xl">{totalAmount.toLocaleString()} د.ج</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                            لم يتم إضافة منتجات للفاتورة بعد
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-gray-600 hover:bg-gray-200 transition-colors">
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || items.length === 0}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        حفظ الفاتورة
                    </button>
                </div>

            </div>

            {/* Nested Product Modal for Quick Add */}
            <ProductModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSuccess={handleProductCreated}
                productToEdit={null}
            />
        </div>
    );
}
