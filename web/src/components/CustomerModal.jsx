import { useState, useEffect } from "react";
import { X, Save, AlertCircle, Upload, FileCheck } from "lucide-react"; // Added Icons
import { supabase } from "../supabase";
import { db } from "../db"; // Import Local DB

export default function CustomerModal({ isOpen, onClose, onSuccess, customerToEdit = null }) {
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        phone: "",
        ccp_number: "",
        ccp_key: "",
        national_id: "",
        address: "",
        notes: "",
    });
    const [combinedDoc, setCombinedDoc] = useState(null); // State for the file
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (customerToEdit) {
            setFormData(customerToEdit);
            // We don't load the file here for editing to keep it light, 
            // user can see it in Documents page or re-upload to overwrite.
        } else {
            setFormData({
                first_name: "",
                last_name: "",
                phone: "",
                ccp_number: "",
                ccp_key: "",
                national_id: "",
                address: "",
                notes: "",
            });
            setCombinedDoc(null);
        }
        setError("");
    }, [customerToEdit, isOpen]);

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Validation
            if (!formData.ccp_number || !formData.ccp_key) {
                throw new Error("رقم CCP والمفتاح (Clé) حقول إجبارية");
            }

            let customerId;

            if (customerToEdit) {
                // Update existing
                const { error } = await supabase
                    .from("customers")
                    .update(formData)
                    .eq("id", customerToEdit.id);
                if (error) throw error;
                customerId = customerToEdit.id;
            } else {
                // Create new
                const { data, error } = await supabase.from("customers").insert([formData]).select();
                if (error) throw error;
                customerId = data[0].id;
            }

            // Save Document to Local DB (Dexie) if a file was selected
            if (combinedDoc) {
                // Check if exists and delete old
                await db.documents.where({ customerId: customerId, type: 'combined_doc' }).delete();

                // Add new
                await db.documents.add({
                    customerId: customerId,
                    type: 'combined_doc',
                    blob: combinedDoc,
                    created_at: new Date()
                });
            }

            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            // Show detailed error if available
            setError((err.message || "حدث خطأ غير معروف") + (err.details ? " (" + err.details + ")" : ""));
        } finally {
            setLoading(false);
        }
    }

    function calculateCCPKey(ccp) {
        if (!ccp) return "";
        const str = ccp.toString();
        let total = 0;

        // Algorithm: Sum of (digit * weight) where weights start from 4 increasing from right to left
        // e.g. last digit * 4, 2nd last * 5, etc.
        for (let i = 0; i < str.length; i++) {
            const digit = parseInt(str[str.length - 1 - i]);
            const weight = i + 4;
            total += digit * weight;
        }

        const key = total % 100;
        return key.toString().padStart(2, '0');
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <h3 className="font-bold text-lg text-gray-800">
                        {customerToEdit ? "تعديل بيانات الزبون" : "إضافة زبون جديد"}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm" dir="ltr">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">الاسم <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="الاسم"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">اللقب <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="اللقب"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                            placeholder="05..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">رقم بطاقة التعريف</label>
                        <input
                            type="text"
                            value={formData.national_id}
                            onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="block text-sm font-medium text-gray-700">رقم CCP (أرقام فقط) <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                value={formData.ccp_number}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, ''); // Numbers only
                                    const autoKey = calculateCCPKey(val);
                                    setFormData({ ...formData, ccp_number: val, ccp_key: autoKey });
                                }}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="الرقم"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">المفتاح (Clé) <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="text"
                                maxLength={2}
                                value={formData.ccp_key}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                    setFormData({ ...formData, ccp_key: val });
                                }}
                                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center bg-gray-50 font-bold text-blue-800"
                                placeholder="00"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">العنوان</label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-16 resize-none"
                        />
                    </div>

                    {/* Local Document Upload */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <Upload size={16} />
                            المرفقات (بطاقة التعريف + الصك)
                        </label>
                        <div className="relative group">
                            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${combinedDoc ? 'border-green-500 bg-green-50' : 'border-blue-300 hover:border-blue-500 hover:bg-white'}`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setCombinedDoc(e.target.files[0])}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                />
                                {combinedDoc ? (
                                    <div className="flex items-center justify-center gap-2 text-green-700">
                                        <FileCheck size={20} />
                                        <span className="font-medium text-sm truncate">{combinedDoc.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-gray-500 text-sm">
                                        <p>اضغط لرفع صورة العقد أو الوثائق</p>
                                        <p className="text-xs text-gray-400 mt-1">(ملف واحد - صورة أو PDF)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? "جاري الحفظ..." : "حفظ الزبون"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
