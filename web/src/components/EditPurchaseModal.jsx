import { useState, useEffect } from "react";
import { X, Save, Plus, Trash2, Search } from "lucide-react";
import { supabase } from "../supabase";

export default function EditPurchaseModal({ isOpen, onClose, purchase, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);

    // Form Data
    const [purchaseDate, setPurchaseDate] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);

    // New Item State
    const [prodSearch, setProdSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemPrice, setNewItemPrice] = useState(0);

    useEffect(() => {
        if (isOpen && purchase) {
            setPurchaseDate(new Date(purchase.created_at).toISOString().split('T')[0]);
            setNotes(purchase.notes || "");
            fetchPurchaseItems();
            fetchProducts();
        }
    }, [isOpen, purchase]);

    async function fetchProducts() {
        const { data } = await supabase.from("products").select("id, name, purchase_price");
        setProducts(data || []);
    }

    async function fetchPurchaseItems() {
        // We need to join with products to get names
        const { data, error } = await supabase
            .from("purchase_items")
            .select("*, products(name)")
            .eq("purchase_id", purchase.id);

        if (data) {
            const mappedItems = data.map(i => ({
                product_id: i.product_id,
                product_name: i.products?.name || "منتج غير معروف",
                quantity: i.quantity,
                unit_price: i.unit_price,
                total: i.total_price
            }));
            setItems(mappedItems);
            calculateTotal(mappedItems);
        }
    }

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()));

    function calculateTotal(currentItems) {
        const total = currentItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        setTotalAmount(total);
    }

    function addItem() {
        const product = selectedProduct;
        if (!product && !prodSearch) return;

        // If arbitrary product (not in DB) we can't easily handle it without ID in purchase_items usually
        // But purchase_items usually requires product_id.
        // For now, force selection.
        if (!product) return alert("الرجاء اختيار منتج من القائمة");

        const newItem = {
            product_id: product.id,
            product_name: product.name,
            quantity: newItemQty,
            unit_price: newItemPrice,
            total: newItemQty * newItemPrice
        };

        const newItems = [...items, newItem];
        setItems(newItems);
        calculateTotal(newItems);

        // Reset
        setSelectedProduct(null);
        setProdSearch("");
        setNewItemQty(1);
        setNewItemPrice(0);
    }

    function removeItem(index) {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        calculateTotal(newItems);
    }

    async function handleSave() {
        if (items.length === 0) return alert("يجب أن تحتوي الفاتورة على منتج واحد على الأقل");
        if (!window.confirm("تحذير: تعديل المنتجات قد يؤثر على المخزون بشكل غير دقيق إذا تم بيع جزء منها. هل تريد المتابعة؟")) return;

        setLoading(true);
        try {
            // 1. Update Purchase Info
            const { error: updateError } = await supabase.from("purchases").update({
                created_at: purchaseDate,
                notes: notes,
                total_amount: totalAmount
                // We keep supplier same for now to avoid complexity
            }).eq("id", purchase.id);

            if (updateError) throw updateError;

            // 2. Delete OLD items
            const { error: deleteError } = await supabase.from("purchase_items").delete().eq("purchase_id", purchase.id);
            if (deleteError) throw deleteError;

            // 3. Insert NEW items
            const { error: insertError } = await supabase.from("purchase_items").insert(
                items.map(i => ({
                    purchase_id: purchase.id,
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    total_price: i.quantity * i.unit_price
                }))
            );

            if (insertError) throw insertError;

            alert("تم تعديل الفاتورة بنجاح");
            onSuccess();
            onClose();

        } catch (error) {
            alert("خطأ أثناء التعديل: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !purchase) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b bg-orange-50">
                    <h3 className="font-bold text-lg text-orange-800">تعديل الفاتورة #{purchase.id} (كامل)</h3>
                    <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-600"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700">تاريخ الفاتورة</label>
                            <div className="flex gap-1">
                                <select
                                    value={purchaseDate.split('-')[0]}
                                    onChange={(e) => {
                                        const newYear = e.target.value;
                                        const m = purchaseDate.split('-')[1];
                                        const d = purchaseDate.split('-')[2];
                                        setPurchaseDate(`${newYear}-${m}-${d}`);
                                    }}
                                    className="w-20 p-2 border rounded-lg text-center bg-gray-50 text-sm"
                                >
                                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <select
                                    value={purchaseDate.split('-')[1]}
                                    onChange={(e) => {
                                        const newMonth = e.target.value;
                                        const y = purchaseDate.split('-')[0];
                                        const d = purchaseDate.split('-')[2];
                                        setPurchaseDate(`${y}-${newMonth}-${d}`);
                                    }}
                                    className="flex-1 p-2 border rounded-lg text-center bg-gray-50 text-sm"
                                >
                                    <option value="01">01 - جانفي</option>
                                    <option value="02">02 - فيفري</option>
                                    <option value="03">03 - مارس</option>
                                    <option value="04">04 - أفريل</option>
                                    <option value="05">05 - ماي</option>
                                    <option value="06">06 - جوان</option>
                                    <option value="07">07 - جويلية</option>
                                    <option value="08">08 - أوت</option>
                                    <option value="09">09 - سبتمبر</option>
                                    <option value="10">10 - أكتوبر</option>
                                    <option value="11">11 - نوفمبر</option>
                                    <option value="12">12 - ديسمبر</option>
                                </select>
                                <select
                                    value={purchaseDate.split('-')[2]}
                                    onChange={(e) => {
                                        const newDay = e.target.value;
                                        const y = purchaseDate.split('-')[0];
                                        const m = purchaseDate.split('-')[1];
                                        setPurchaseDate(`${y}-${m}-${newDay}`);
                                    }}
                                    className="w-16 p-2 border rounded-lg text-center bg-gray-50 text-sm"
                                >
                                    {Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">ملاحظات</label>
                            <input
                                type="text" value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <h4 className="font-bold text-gray-700 mb-2">المنتجات</h4>

                        {/* Add Item Bar */}
                        <div className="flex gap-2 items-end mb-4">
                            <div className="flex-1 relative">
                                <label className="text-xs font-bold text-gray-500">بحث عن منتج</label>
                                {!selectedProduct ? (
                                    <>
                                        <input
                                            type="text" value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                                            className="w-full p-2 border rounded-lg" placeholder="اسم المنتج..."
                                        />
                                        {prodSearch && filteredProducts.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-white shadow-lg border rounded-lg mt-1 z-10 max-h-40 overflow-auto">
                                                {filteredProducts.map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => { setSelectedProduct(p); setNewItemPrice(p.purchase_price); }}
                                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                    >
                                                        {p.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex justify-between items-center p-2 bg-white border rounded-lg">
                                        <span>{selectedProduct.name}</span>
                                        <button onClick={() => setSelectedProduct(null)}><X size={14} /></button>
                                    </div>
                                )}
                            </div>
                            <div className="w-20">
                                <label className="text-xs font-bold text-gray-500">الكمية</label>
                                <input
                                    type="number" value={newItemQty} onChange={e => setNewItemQty(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg text-center"
                                />
                            </div>
                            <div className="w-28">
                                <label className="text-xs font-bold text-gray-500">السعر</label>
                                <input
                                    type="number" value={newItemPrice} onChange={e => setNewItemPrice(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg text-center"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={addItem}
                                disabled={!selectedProduct}
                                className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 mb-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {/* Items Table */}
                        <table className="w-full text-right text-sm bg-white rounded-lg overflow-hidden border">
                            <thead className="bg-gray-100 font-bold">
                                <tr>
                                    <td className="p-2">المنتج</td>
                                    <td className="p-2">الكمية</td>
                                    <td className="p-2">السعر</td>
                                    <td className="p-2">الإجمالي</td>
                                    <td className="p-2"></td>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="p-2">{item.product_name}</td>
                                        <td className="p-2">{item.quantity}</td>
                                        <td className="p-2">{item.unit_price.toLocaleString()}</td>
                                        <td className="p-2 font-bold">{(item.quantity * item.unit_price).toLocaleString()}</td>
                                        <td className="p-2">
                                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <span className="font-bold text-orange-900">المجموع الجديد:</span>
                        <span className="text-2xl font-bold text-orange-700">{totalAmount.toLocaleString()} د.ج</span>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-200"
                    >
                        {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
                    </button>
                </div>
            </div>
        </div>
    );
}
