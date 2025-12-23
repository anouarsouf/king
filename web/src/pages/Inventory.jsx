import { useState, useEffect } from "react";
import { Package, Search, ArrowRightLeft, Plus, Building2, Filter } from "lucide-react";
import { supabase } from "../supabase";
import { useProfile } from "../hooks/useProfile";

export default function Inventory() {
    const { profile } = useProfile();
    const isAdmin = !profile?.branch_id;

    const [stock, setStock] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [products, setProducts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState({
        branchId: "all", // 'all', 'central', or specific ID
        search: ""
    });

    const [dateFilter, setDateFilter] = useState(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth(); // 0-indexed

        // Start: Today
        const start = today.toISOString().split('T')[0];

        // End: Last day of current month
        const lastDay = new Date(y, m + 1, 0);
        const end = lastDay.toISOString().split('T')[0];

        return { start, end };
    });

    // Modals
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);

    // Forms
    const [importForm, setImportForm] = useState({ product_id: "", quantity: 1 });
    const [transferForm, setTransferForm] = useState({ product_id: "", from_branch: "", to_branch: "", quantity: 1 });

    useEffect(() => {
        fetchData();
    }, [filters.branchId]); // Only refresh automatically on branch filter change

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Fetch Products & Branches for Selects
            const { data: pData } = await supabase.from("products").select("id, name, reference");
            const { data: bData } = await supabase.from("branches").select("id, name");

            setProducts(pData || []);
            setBranches(bData || []);

            // 2. Fetch Stock
            let query = supabase
                .from("branch_stock")
                .select(`
                    id, 
                    quantity, 
                    product_id, 
                    branch_id,
                    products (name, reference),
                    branches (name)
                `)
                .order('product_id');

            // Apply Filters
            if (filters.branchId !== "all") {
                if (filters.branchId === "central") {
                    query = query.is("branch_id", null);
                } else {
                    query = query.eq("branch_id", filters.branchId);
                }
            }

            const { data: sData, error } = await query;
            if (error) throw error;
            setStock(sData || []);

            // 3. Fetch Transfers
            let tQuery = supabase
                .from("stock_transfers")
                .select("*, products(name), b_from:from_branch_id(name), b_to:to_branch_id(name)")
                .order("created_at", { ascending: false });

            if (dateFilter.start) tQuery = tQuery.gte("created_at", dateFilter.start);
            if (dateFilter.end) tQuery = tQuery.lte("created_at", dateFilter.end + "T23:59:59");

            const { data: tData } = await tQuery;
            setTransfers(tData || []);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // --- ACTIONS ---

    async function handleImport(e) {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc("admin_add_central_stock", {
                p_product_id: parseInt(importForm.product_id),
                p_quantity: parseInt(importForm.quantity)
            });
            if (error) throw error;

            alert("تم إدخال المخزون للمستودع المركزي بنجاح ✅");
            setIsImportOpen(false);
            fetchData();
        } catch (err) {
            alert("خطأ: " + err.message);
        }
    }

    async function handleTransfer(e) {
        e.preventDefault();
        // Validation
        const from = transferForm.from_branch === "central" ? null : parseInt(transferForm.from_branch);
        const to = transferForm.to_branch === "central" ? null : parseInt(transferForm.to_branch);

        if (from === to) return alert("لا يمكن التحويل لنفس المكان!");

        try {
            const { error } = await supabase.rpc("process_inventory_transfer", {
                p_product_id: parseInt(transferForm.product_id),
                p_from_branch_id: from,
                p_to_branch_id: to,
                p_quantity: parseInt(transferForm.quantity)
            });
            if (error) throw error;

            alert("تم التحويل بنجاح 🔄");
            setIsTransferOpen(false);
            fetchData();
        } catch (err) {
            alert("خطأ: " + err.message);
        }
    }

    async function handleDeleteTransfer(id) {
        if (!window.confirm("حذف هذا التحويل؟\nسيتم إرجاع الكميات تلقائياً.")) return;

        try {
            const { error } = await supabase.rpc("delete_branch_transfer", { p_transfer_id: id });
            if (error) throw error;

            alert("تم حذف التحويل وإرجاع المخزون.");
            fetchData();
        } catch (error) {
            alert("خطأ: " + error.message);
        }
    }

    // --- RENDER HELPERS ---

    const filteredStock = stock.filter(item => {
        if (!filters.search) return true;
        const s = filters.search.toLowerCase();
        return item.products?.name.toLowerCase().includes(s) ||
            item.products?.reference?.toLowerCase().includes(s);
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                        <Package className="text-blue-600" size={28} />
                        إدارة المخزون المركزي
                    </h2>
                    <p className="text-gray-500 mt-1">مراقبة توزيع البضائع بين المستودع المركزي والفروع</p>
                </div>

                {isAdmin && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsImportOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-200 transition-all"
                        >
                            <Plus size={20} />
                            إدخال سلعة (Import)
                        </button>
                        <button
                            onClick={() => setIsTransferOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
                        >
                            <ArrowRightLeft size={20} />
                            تحويل مخزون (Transfer)
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="بحث عن منتج..."
                        value={filters.search}
                        onChange={e => setFilters({ ...filters, search: e.target.value })}
                        className="w-full p-2.5 pr-10 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={filters.branchId}
                        onChange={e => setFilters({ ...filters, branchId: e.target.value })}
                        className="w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                    >
                        <option value="all">كل المخازن</option>
                        <option value="central">🏢 المستودع المركزي</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>📍 فرع: {b.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                        <tr>
                            <td className="p-4">المنتج</td>
                            <td className="p-4">مكان التواجد</td>
                            <td className="p-4 text-center">الكمية المتوفرة</td>
                            <td className="p-4">الحالة</td>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500">جاري تحميل البيانات...</td></tr>
                        ) : filteredStock.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">لا توجد بيانات مخزون</td></tr>
                        ) : (
                            filteredStock.map(item => (
                                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{item.products?.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{item.products?.reference || '-'}</div>
                                    </td>
                                    <td className="p-4">
                                        {item.branch_id ? (
                                            <span className="flex items-center gap-1 text-gray-700">
                                                <Building2 size={16} className="text-gray-400" />
                                                فرع: {item.branches?.name}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded w-fit">
                                                🏢 المستودع المركزي
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`font-bold text-lg ${item.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {item.quantity}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {item.quantity <= 5 ? (
                                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">منخفض</span>
                                        ) : (
                                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">متوفر</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Transfer History Table */}
            {isAdmin && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <h3 className="p-4 font-bold text-gray-700 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={18} />
                            سجل التحويلات الأخيرة (History)
                        </div>
                        <div className="flex items-center gap-2 text-sm font-normal">
                            <input
                                type="date"
                                className="p-2 border rounded-lg"
                                value={dateFilter.start}
                                onChange={e => setDateFilter({ ...dateFilter, start: e.target.value })}
                            />
                            <span className="text-gray-400">إلى</span>
                            <input
                                type="date"
                                className="p-2 border rounded-lg"
                                value={dateFilter.end}
                                onChange={e => setDateFilter({ ...dateFilter, end: e.target.value })}
                            />
                            <button
                                onClick={fetchData}
                                className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-all"
                            >
                                بحث 🔍
                            </button>
                        </div>
                    </h3>
                    <table className="w-full text-right text-sm">
                        <thead className="bg-white text-gray-500 font-bold">
                            <tr>
                                <td className="p-4">المنتج</td>
                                <td className="p-4">من (Source)</td>
                                <td className="p-4">إلى (Target)</td>
                                <td className="p-4">الكمية</td>
                                <td className="p-4">التاريخ</td>
                                <td className="p-4"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transfers.length === 0 ? (
                                <tr><td colSpan="6" className="p-6 text-center text-gray-400">لا توجد تحويلات سابقة</td></tr>
                            ) : (
                                transfers.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{t.products?.name}</td>
                                        <td className="p-4 text-red-600 font-medium">
                                            {t.b_from?.name || "🏢 المركزي"}
                                        </td>
                                        <td className="p-4 text-green-600 font-medium">
                                            {t.b_to?.name || "🏢 المركزي"}
                                        </td>
                                        <td className="p-4 font-bold">{t.quantity}</td>
                                        <td className="p-4 text-gray-400">{new Date(t.created_at).toLocaleDateString("en-GB")}</td>
                                        <td className="p-4 flex justify-end">
                                            <button
                                                onClick={() => handleDeleteTransfer(t.id)}
                                                className="text-red-500 text-xs border border-red-200 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                                            >
                                                استرجاع
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- IMPORT MODAL --- */}
            {isImportOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 bg-green-50 flex justify-between items-center rounded-t-2xl">
                            <h3 className="font-bold text-lg text-green-900 flex items-center gap-2">
                                <Plus size={22} />
                                إدخال سلعة (Import)
                            </h3>
                            <button onClick={() => setIsImportOpen(false)} className="text-green-700 hover:bg-green-100 p-1 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handleImport} className="p-6 space-y-4">
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                سيتم إضافة الكمية مباشرة إلى <strong>المستودع المركزي</strong>.
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">المنتج</label>
                                <select
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                                    required
                                    value={importForm.product_id}
                                    onChange={e => setImportForm({ ...importForm, product_id: e.target.value })}
                                >
                                    <option value="">اختر المنتج...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.reference})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية</label>
                                <input
                                    type="number" min="1"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-lg"
                                    required
                                    value={importForm.quantity}
                                    onChange={e => setImportForm({ ...importForm, quantity: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200 transition-all">
                                تأكيد الإدخال
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- TRANSFER MODAL --- */}
            {isTransferOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 bg-blue-50 flex justify-between items-center rounded-t-2xl">
                            <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                                <ArrowRightLeft size={22} />
                                تحويل مخزون (Transfer)
                            </h3>
                            <button onClick={() => setIsTransferOpen(false)} className="text-blue-700 hover:bg-blue-100 p-1 rounded-full">✕</button>
                        </div>
                        <form onSubmit={handleTransfer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">المنتج</label>
                                <select
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                    value={transferForm.product_id}
                                    onChange={e => setTransferForm({ ...transferForm, product_id: e.target.value })}
                                >
                                    <option value="">اختر المنتج...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">من (المصدر)</label>
                                    <select
                                        className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        required
                                        value={transferForm.from_branch}
                                        onChange={e => setTransferForm({ ...transferForm, from_branch: e.target.value })}
                                    >
                                        <option value="">اختر...</option>
                                        <option value="central">🏢 المركزي</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">إلى (الوجهة)</label>
                                    <select
                                        className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        required
                                        value={transferForm.to_branch}
                                        onChange={e => setTransferForm({ ...transferForm, to_branch: e.target.value })}
                                    >
                                        <option value="">اختر...</option>
                                        <option value="central">🏢 المركزي</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية</label>
                                <input
                                    type="number" min="1"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                    required
                                    value={transferForm.quantity}
                                    onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })}
                                />
                            </div>
                            <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all">
                                تنفيذ التحويل
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
