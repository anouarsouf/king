import { useState, useEffect } from "react";
import { X, DollarSign, Wallet } from "lucide-react";
import { supabase } from "../supabase";

export default function PurchasePaymentModal({ isOpen, onClose, purchase, onSuccess }) {
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && purchase) {
            // Default to full remaining amount
            const remaining = purchase.total_amount - (purchase.paid_amount || 0);
            setAmount(remaining);
        }
    }, [isOpen, purchase]);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            const payAmount = parseFloat(amount);
            if (isNaN(payAmount) || payAmount <= 0) throw new Error("المبلغ غير صحيح");

            const { error } = await supabase.rpc('pay_purchase_partially', {
                p_purchase_id: purchase.id,
                p_amount: payAmount
            });

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (err) {
            alert("خطأ: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !purchase) return null;

    const remaining = purchase.total_amount - (purchase.paid_amount || 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-green-50">
                    <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
                        <Wallet className="text-green-600" size={20} />
                        تسديد دفعة
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-green-100 rounded-full text-green-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-gray-50 p-3 rounded-xl text-center mb-4">
                        <span className="block text-gray-500 text-xs font-bold mb-1">المبلغ المتبقي</span>
                        <span className="text-xl font-black text-gray-800">{remaining.toLocaleString()} د.ج</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">مبلغ الدفع</label>
                        <input
                            type="number"
                            autoFocus
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-xl font-bold text-center"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200"
                    >
                        {loading ? "جاري التسجيل..." : "تأكيد الدفع"}
                    </button>
                </form>
            </div>
        </div>
    );
}
