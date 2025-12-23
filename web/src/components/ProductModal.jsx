import { useState, useEffect } from "react";
import { X, Save, Package } from "lucide-react";
import { supabase } from "../supabase";

export default function ProductModal({ isOpen, onClose, productToEdit, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        reference: "",
        cash_price: "",
        cash_price_2: "",
        cash_price_3: "",
        installment_price: "",
        purchase_price: "",
        stock_quantity: "",
        description: ""
    });

    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                setFormData({
                    name: productToEdit.name,
                    reference: productToEdit.reference || "",
                    cash_price: productToEdit.cash_price,
                    cash_price_2: productToEdit.cash_price_2 || productToEdit.cash_price,
                    cash_price_3: productToEdit.cash_price_3 || productToEdit.cash_price,
                    installment_price: productToEdit.installment_price,
                    purchase_price: productToEdit.purchase_price || "",
                    stock_quantity: productToEdit.stock_quantity,
                    description: productToEdit.description || ""
                });
            } else {
                // Reset for new product
                setFormData({
                    name: "",
                    reference: "",
                    cash_price: "",
                    cash_price_2: "",
                    cash_price_3: "",
                    installment_price: "",
                    purchase_price: "",
                    stock_quantity: "",
                    description: ""
                });
            }
        }
    }, [isOpen, productToEdit]);

    // Auto-sync prices when Price 1 changes
    const handlePrice1Change = (val) => {
        setFormData({
            ...formData,
            cash_price: val,
            cash_price_2: val, // Auto-populate
            cash_price_3: val  // Auto-populate
        });
    };

    async function handleSubmit(e) {
        e.preventDefault();

        // Validation
        const stock = parseInt(formData.stock_quantity);
        if (isNaN(stock) || stock <= 0) {
            return alert("يجب إدخال الكمية (يجب أن تكون أكبر من 0)");
        }

        setLoading(true);

        try {
            const payload = { ...formData };

            // Ensure numeric values
            payload.cash_price = parseFloat(payload.cash_price);
            payload.cash_price_2 = parseFloat(payload.cash_price_2 || payload.cash_price);
            payload.cash_price_3 = parseFloat(payload.cash_price_3 || payload.cash_price);
            payload.installment_price = parseFloat(payload.installment_price);
            payload.purchase_price = parseFloat(payload.purchase_price);
            payload.stock_quantity = stock;

            if (!payload.purchase_price) throw new Error("سعر الشراء إجباري");

            let error;
            if (productToEdit) {
                // Update
                const { error: updateError } = await supabase
                    .from("products")
                    .update(payload)
                    .eq("id", productToEdit.id);
                error = updateError;
            } else {
                // Create
                const { error: insertError } = await supabase
                    .from("products")
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;

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

                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                        <Package className="text-blue-600" />
                        {productToEdit ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2">
                            <label className="text-sm font-bold text-gray-700">اسم المنتج <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="مثال: iPhone 15 Pro Max"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">المرجع (Reference)</label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="CODE-123"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">الكمية في المخزون</label>
                            <input
                                type="number"
                                value={formData.stock_quantity}
                                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">سعر الشراء (التكلفة) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        value={formData.purchase_price}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                                        className="w-full p-3 pl-12 border border-gray-200 rounded-xl font-bold text-gray-600 focus:ring-2 focus:ring-gray-500 outline-none"
                                        placeholder="0"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">DZD</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-blue-700">سعر التقسيط (بيع) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        value={formData.installment_price}
                                        onChange={(e) => setFormData({ ...formData, installment_price: e.target.value })}
                                        className="w-full p-3 pl-12 border border-blue-200 bg-blue-50 rounded-xl font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-bold">DZD</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-green-700">سعر الكاش 1 <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        value={formData.cash_price}
                                        onChange={(e) => handlePrice1Change(e.target.value)}
                                        className="w-full p-3 pl-12 border border-green-200 bg-green-50 rounded-xl font-bold text-green-800 focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 text-sm font-bold">DZD</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-green-600">سعر الكاش 2</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.cash_price_2}
                                        onChange={(e) => setFormData({ ...formData, cash_price_2: e.target.value })}
                                        className="w-full p-3 pl-12 border border-gray-200 rounded-xl font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-300 text-sm font-bold">DZD</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-green-600">سعر الكاش 3</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.cash_price_3}
                                        onChange={(e) => setFormData({ ...formData, cash_price_3: e.target.value })}
                                        className="w-full p-3 pl-12 border border-gray-200 rounded-xl font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-300 text-sm font-bold">DZD</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">ملاحظات / وصف</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? "جاري الحفظ..." : "حفظ المنتج"}
                        <Save size={20} />
                    </button>

                </form>
            </div>
        </div>
    );
}
