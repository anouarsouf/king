import { useState } from "react";
import { supabase } from "../supabase";
import { Search, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function CustomerPortal() {
    const [ccp, setCcp] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    async function handleSearch(e) {
        e.preventDefault();
        if (!ccp.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            // 1. Find customer by CCP
            const { data: customers, error: custError } = await supabase
                .from("customers")
                .select("id, first_name, last_name, phone")
                .eq("ccp_number", ccp.trim())
                .limit(1);

            if (custError) throw custError;

            if (!customers || customers.length === 0) {
                setError("لم يتم العثور على أي عميل بهذا الرقم البريدي.");
                setLoading(false);
                return;
            }

            const customer = customers[0];

            // 2. Find active sales for this customer
            const { data: sales, error: salesError } = await supabase
                .from("sales")
                .select("*, installments(*)")
                .eq("customer_id", customer.id)
                .neq("status", "cancelled");

            if (salesError) throw salesError;

            if (!sales || sales.length === 0) {
                setError("لا توجد عمليات بيع نشطة لهذا العميل.");
                setLoading(false);
                return;
            }

            setData({ customer, sales });

        } catch (err) {
            console.error(err);
            setError("حدث خطأ أثناء البحث. يرجى المحاولة لاحقاً.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dir-rtl font-sans" style={{ direction: "rtl" }}>
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 p-4">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                        <CheckCircle className="text-indigo-600" />
                        بوابة الزبائن
                    </h1>
                </div>
            </div>

            {/* Search Section */}
            <div className="max-w-md mx-auto mt-10 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <h2 className="text-center font-bold text-gray-800 text-lg mb-2">متابعة أقساطك</h2>
                    <p className="text-center text-gray-400 text-sm mb-6">أدخل رقم الحساب البريدي (CCP) للاطلاع على وضعيتك</p>

                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            placeholder="رقم CCP (بدون المفتاح)"
                            className="w-full pl-4 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-lg text-center dir-ltr"
                            value={ccp}
                            onChange={(e) => setCcp(e.target.value)}
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />

                        <button
                            type="submit"
                            disabled={loading || !ccp}
                            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "جاري البحث..." : "استعراض الوضعية"}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100 animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Section */}
            {data && (
                <div className="max-w-3xl mx-auto mt-8 p-4 pb-20 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                            {data.customer.first_name[0]}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">{data.customer.first_name} {data.customer.last_name}</h3>
                            <p className="text-sm text-gray-500 font-mono">CCP: {ccp}</p>
                        </div>
                    </div>

                    {data.sales.map((sale) => (
                        <div key={sale.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase block">المنتج</span>
                                    <span className="font-bold text-gray-800">{sale.product_names || "منتج غير محدد"}</span>
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold text-gray-500 uppercase">المتبقي للدفع</div>
                                    <div className="font-black text-red-600 text-lg">
                                        {(sale.total_amount - sale.paid_amount).toLocaleString()} <span className="text-xs text-gray-400">د.ج</span>
                                    </div>
                                </div>
                            </div>

                            {sale.sale_type === 'installment' && (
                                <div className="divide-y divide-gray-100">
                                    {sale.installments
                                        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
                                        .map((inst, idx) => (
                                            <div key={inst.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-mono text-xs font-bold">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-mono text-gray-800 font-medium">
                                                            {new Date(inst.due_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {inst.amount.toLocaleString()} د.ج
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    {inst.status === 'paid' ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                                                            <CheckCircle size={14} /> مدفوع
                                                        </span>
                                                    ) : new Date(inst.due_date) < new Date() ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100">
                                                            <Clock size={14} /> متأخر
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-full border border-yellow-100">
                                                            <Clock size={14} /> قادم
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
