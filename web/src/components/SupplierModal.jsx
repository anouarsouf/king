import { useState, useEffect } from "react";
import { X, Save, User, Truck, Phone, MapPin } from "lucide-react";
import { supabase } from "../supabase";

export default function SupplierModal({ isOpen, onClose, supplierToEdit, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        phone: "",
        address: ""
    });

    useEffect(() => {
        if (isOpen) {
            if (supplierToEdit) {
                setFormData({
                    first_name: supplierToEdit.first_name,
                    last_name: supplierToEdit.last_name,
                    phone: supplierToEdit.phone || "",
                    address: supplierToEdit.address || ""
                });
            } else {
                setFormData({ first_name: "", last_name: "", phone: "", address: "" });
            }
        }
    }, [isOpen, supplierToEdit]);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            if (supplierToEdit) {
                const { error } = await supabase
                    .from("suppliers")
                    .update(formData)
                    .eq("id", supplierToEdit.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("suppliers")
                    .insert([formData]);
                if (error) throw error;
            }

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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-orange-50">
                    <h3 className="font-bold text-xl text-orange-800 flex items-center gap-2">
                        <Truck className="text-orange-600" />
                        {supplierToEdit ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-500">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">الاسم</label>
                            <input
                                required
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">اللقب</label>
                            <input
                                required
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Phone size={14} /> رقم الهاتف
                        </label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="0XXXXXXXXX"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MapPin size={14} /> العنوان
                        </label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? "جاري الحفظ..." : "حفظ المورد"}
                        <Save size={20} />
                    </button>

                </form>
            </div>
        </div>
    );
}
