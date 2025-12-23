import { useEffect, useState } from "react";
import { Plus, Search, ShoppingCart, Calendar, CreditCard, ChevronDown, Trash2, Pencil, LayoutGrid, List as ListIcon } from "lucide-react";
import { supabase } from "../supabase";
import SaleDetailsModal from "../components/SaleDetailsModal";
import InstallmentSaleModal from "../components/InstallmentSaleModal";
import CashSaleModal from "../components/CashSaleModal";
import EditSaleModal from "../components/EditSaleModal";

export default function Sales() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // UI State
    const [displayMode, setDisplayMode] = useState("list"); // 'grid' or 'list'
    const [activeTab, setActiveTab] = useState("installment"); // 'installment' or 'cash'

    // Modals
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newModalType, setNewModalType] = useState("installment");
    const [selectedSale, setSelectedSale] = useState(null);
    const [editSaleData, setEditSaleData] = useState(null);

    useEffect(() => {
        fetchSales();
    }, []);

    async function fetchSales() {
        setLoading(true);
        // Fetch sales with customer details
        const { data, error } = await supabase
            .from("sales")
            .select("*, customers(first_name, last_name, phone, ccp_number, ccp_key)")
            .neq('status', 'cancelled') // Hide deleted/cancelled sales from active list
            .order("created_at", { ascending: false });

        if (error) console.error("Error fetching sales:", error);
        else setSales(data || []);
        setLoading(false);
    }

    async function handleDelete(id) {
        if (!window.confirm("هل أنت متأكد من حذف هذا العقد؟ سيتم حذف جميع الأقساط المرتبطة به.")) return;

        try {
            // 1. Delete Installments
            const { error: installError } = await supabase.from("installments").delete().eq("sale_id", id);
            if (installError) throw installError;

            // 2. Delete Treasury Transactions (Payments)
            const { error: treasuryError } = await supabase.from("treasury_transactions")
                .delete()
                .eq("reference_id", id)
                .in("category", ["sale_payment", "down_payment", "installment_payment"]);

            if (treasuryError) throw treasuryError;

            // 3. Delete Sale
            const { error: saleError } = await supabase.from("sales").delete().eq("id", id);
            if (saleError) throw saleError;

            fetchSales();
        } catch (error) {
            alert("خطأ في الحذف: " + error.message);
        }
    }

    const filteredSales = sales.filter(sale => {
        const matchesSearch =
            sale.id.toString().includes(searchTerm) ||
            (sale.customers?.first_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sale.customers?.last_name || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = sale.sale_type === activeTab;

        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <ShoppingCart className="text-blue-600" />
                    إدارة المبيعات والعقود
                </h2>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="بحث برقم العقد أو اسم الزبون..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    <div className="flex gap-2 border-l pl-2 ml-2 border-gray-200">
                        <button
                            onClick={() => setDisplayMode("grid")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض شبكي"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setDisplayMode("list")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض قائمة"
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => { setNewModalType("cash"); setIsNewModalOpen(true); }}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold"
                        >
                            <Plus size={18} />
                            <span>بيع كاش</span>
                        </button>
                        <button
                            onClick={() => { setNewModalType("installment"); setIsNewModalOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-bold"
                        >
                            <Plus size={18} />
                            <span>بيع تقسيط</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    onClick={() => setActiveTab("installment")}
                    className={`pb-3 px-6 text-sm font-bold transition-all relative ${activeTab === "installment"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    مبيعات بالتقسيط
                </button>
                <button
                    onClick={() => setActiveTab("cash")}
                    className={`pb-3 px-6 text-sm font-bold transition-all relative ${activeTab === "cash"
                        ? "text-green-600 border-b-2 border-green-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    مبيعات كاش (نقداً)
                </button>
            </div>

            {displayMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Grid View */}
                    {filteredSales.map((sale) => (
                        <div key={sale.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className={`absolute top-0 left-0 w-1 h-full ${sale.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}></div>

                            <div className="absolute top-2 left-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditSaleData(sale); }}
                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-100 shadow-sm"
                                    title="تعديل العقد"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(sale.id); }}
                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-100 shadow-sm"
                                    title="حذف العقد"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">
                                        {sale.customers?.first_name} {sale.customers?.last_name}
                                    </h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                        <Calendar size={14} />
                                        {new Date(sale.created_at).toLocaleDateString("ar-DZ")}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${sale.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                                    }`}>
                                    {sale.status === 'completed' ? 'خالص' : 'نشط'}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">المنتجات:</span>
                                    <span className="font-medium text-gray-800 truncate max-w-[150px]">{sale.product_names || "منتجات مختلفة"}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">الإجمالي:</span>
                                    <span className="font-bold text-gray-800">{sale.total_amount?.toLocaleString()} د.ج</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">المدفوع:</span>
                                    <span className="font-bold text-green-600">{sale.paid_amount?.toLocaleString()} د.ج</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">الباقي:</span>
                                    <span className="font-bold text-red-500">
                                        {(sale.total_amount - sale.paid_amount)?.toLocaleString()} د.ج
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedSale(sale)}
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                            >
                                عرض التفاصيل
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* List View */}
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                            <tr>
                                <td className="p-4">رقم العقد</td>
                                <td className="p-4">الزبون</td>
                                <td className="p-4">التاريخ</td>
                                <td className="p-4">المنتجات</td>
                                <td className="p-4">المبلغ الإجمالي</td>
                                <td className="p-4">المدفوع</td>
                                <td className="p-4">الباقي</td>
                                <td className="p-4">الحالة</td>
                                <td className="p-4"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4 font-mono text-gray-500">#{sale.id}</td>
                                    <td className="p-4 font-bold text-gray-800">
                                        {sale.customers?.first_name} {sale.customers?.last_name}
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {new Date(sale.created_at).toLocaleDateString("en-GB")}
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                                        {sale.product_names || "-"}
                                    </td>
                                    <td className="p-4 font-bold text-gray-800">{sale.total_amount?.toLocaleString()}</td>
                                    <td className="p-4 font-bold text-green-600">{sale.paid_amount?.toLocaleString()}</td>
                                    <td className="p-4 font-bold text-red-500">{(sale.total_amount - sale.paid_amount)?.toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${sale.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {sale.status === 'completed' ? 'خالص' : 'نشط'}
                                        </span>
                                    </td>
                                    <td className="p-4 flex justify-end gap-2">
                                        <button
                                            onClick={() => setEditSaleData(sale)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="تعديل"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sale.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => setSelectedSale(sale)}
                                            className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 font-bold"
                                        >
                                            تفاصيل
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredSales.length === 0 && !loading && (
                <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-gray-100 border-dashed">
                    <ShoppingCart className="mx-auto text-gray-300 mb-2" size={48} />
                    <p>لا توجد مبيعات في هذه القائمة</p>
                </div>
            )}

            <SaleDetailsModal
                isOpen={!!selectedSale}
                onClose={() => setSelectedSale(null)}
                sale={selectedSale}
                onSuccess={fetchSales}
            />

            <InstallmentSaleModal
                isOpen={isNewModalOpen && newModalType === "installment"}
                onClose={() => setIsNewModalOpen(false)}
                onSuccess={() => fetchSales()}
            />

            <CashSaleModal
                isOpen={isNewModalOpen && newModalType === "cash"}
                onClose={() => setIsNewModalOpen(false)}
                onSuccess={() => fetchSales()}
            />

            <EditSaleModal
                isOpen={!!editSaleData}
                onClose={() => setEditSaleData(null)}
                sale={editSaleData}
                onSuccess={fetchSales}
            />
        </div>
    );
}
