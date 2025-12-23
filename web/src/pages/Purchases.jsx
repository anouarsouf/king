import { useEffect, useState } from "react";
import { Plus, Search, ShoppingBag, Calendar, User, Trash2, LayoutGrid, List as ListIcon, Edit } from "lucide-react";
import { supabase } from "../supabase";
import NewPurchaseModal from "../components/NewPurchaseModal";
import PurchasePaymentModal from "../components/PurchasePaymentModal";
import PurchaseDetailsModal from "../components/PurchaseDetailsModal";
import EditPurchaseModal from "../components/EditPurchaseModal";

export default function Purchases() {
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [displayMode, setDisplayMode] = useState("list"); // 'grid' or 'list'

    // Modals state
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [paymentModalData, setPaymentModalData] = useState(null); // { isOpen: bool, purchase: obj }
    const [detailsModalData, setDetailsModalData] = useState(null); // { isOpen: bool, purchase: obj }
    const [editModalData, setEditModalData] = useState(null); // { isOpen, purchase }

    const [userProfile, setUserProfile] = useState(null);

    async function fetchProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            setUserProfile(data);
        }
    }

    useEffect(() => {
        fetchPurchases();
        fetchProfile();
    }, []);

    async function fetchPurchases() {
        setLoading(true);
        // Explicitly select supplier details via the foreign key relation
        const { data, error } = await supabase
            .from("purchases")
            .select("*, suppliers(first_name, last_name)")
            .neq('status', 'cancelled') // Hide cancelled purchases
            .order("created_at", { ascending: false });

        if (error) console.error(error);
        else setPurchases(data || []);
        setLoading(false);
    }

    async function handleDelete(id) {
        if (!window.confirm("هل أنت متأكد من حذف هذه الفاتورة؟\nسيتم إلغاء تأثيرها المالي وإرجاع المخزون.")) return;

        try {
            const { error } = await supabase.rpc("delete_purchase_invoice", { p_purchase_id: id });
            if (error) throw error;

            alert("تم حذف الفاتورة بنجاح");
            fetchPurchases();
        } catch (error) {
            alert("خطأ في الحذف: " + error.message);
        }
    }

    const filteredPurchases = purchases.filter(p =>
        (p.suppliers?.first_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.suppliers?.last_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper to check if user is admin (no branch assigned)
    const isAdmin = userProfile && userProfile.branch_id === null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <ShoppingBag className="text-purple-600" />
                    فواتير الشراء
                </h2>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="بحث باسم المورد..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                    </div>

                    <div className="flex gap-2 border-l pl-2 ml-2 border-gray-200">
                        <button
                            onClick={() => setDisplayMode("grid")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'grid' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض شبكي"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setDisplayMode("list")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض قائمة"
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md font-bold"
                        >
                            <Plus size={20} />
                            <span>فاتورة جديدة</span>
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">جاري تحميل البيانات...</div>
            ) : filteredPurchases.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">لا توجد فواتير مسجلة.</div>
            ) : displayMode === 'grid' ? (
                // GRID VIEW
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPurchases.map(purchase => {
                        let statusColor = "bg-red-100 text-red-700";
                        let statusText = "غير مسددة";

                        if (purchase.status === 'paid') {
                            statusColor = "bg-green-100 text-green-700";
                            statusText = "مسددة";
                        } else if (purchase.status === 'paid_partial') {
                            statusColor = "bg-orange-100 text-orange-700";
                            statusText = "تسديد جزئي";
                        }

                        return (
                            <div key={purchase.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                                {isAdmin && (
                                    <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditModalData(purchase); }}
                                            className="p-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100"
                                            title="تعديل"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(purchase.id); }}
                                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                            title="حذف"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800">
                                            {purchase.suppliers ? `${purchase.suppliers.first_name || ''} ${purchase.suppliers.last_name || ''}` : "مورد محذوف"}
                                        </h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                            <Calendar size={14} />
                                            {purchase.created_at ? new Date(purchase.created_at).toLocaleDateString("en-GB") : "-"}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${statusColor}`}>
                                        {statusText}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">الإجمالي:</span>
                                        <span className="font-bold text-purple-700">{(purchase.total_amount || 0).toLocaleString()} د.ج</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">المدفوع:</span>
                                        <span className="font-bold text-green-700">{(purchase.paid_amount || 0).toLocaleString()} د.ج</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDetailsModalData(purchase)}
                                        className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                                    >
                                        عرض التفاصيل
                                    </button>
                                    {isAdmin && purchase.status !== 'paid' && (
                                        <button
                                            onClick={() => setPaymentModalData(purchase)}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                        >
                                            تسديد
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // LIST VIEW
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                            <tr>
                                <td className="p-4">رقم الفاتورة</td>
                                <td className="p-4">الحالة</td>
                                <td className="p-4">المورد</td>
                                <td className="p-4">التاريخ</td>
                                <td className="p-4">المبلغ الإجمالي</td>
                                <td className="p-4">المدفوع</td>
                                <td className="p-4"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredPurchases.map(purchase => {
                                let statusColor = "bg-red-100 text-red-700";
                                let statusText = "غير مسددة";

                                if (purchase.status === 'paid') {
                                    statusColor = "bg-green-100 text-green-700";
                                    statusText = "مسددة";
                                } else if (purchase.status === 'paid_partial') {
                                    statusColor = "bg-orange-100 text-orange-700";
                                    statusText = "تسديد جزئي";
                                }

                                return (
                                    <tr key={purchase.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono text-gray-500">#{purchase.id}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${statusColor}`}>
                                                {statusText}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-gray-800">
                                            {purchase.suppliers ? `${purchase.suppliers.first_name || ''} ${purchase.suppliers.last_name || ''}` : "مورد محذوف"}
                                        </td>
                                        <td className="p-4 text-gray-600 flex items-center gap-2">
                                            <Calendar size={14} />
                                            {purchase.created_at ? new Date(purchase.created_at).toLocaleDateString("en-GB") : "-"}
                                        </td>
                                        <td className="p-4 font-bold text-purple-700">{(purchase.total_amount || 0).toLocaleString()} د.ج</td>
                                        <td className="p-4 font-bold text-green-700">{(purchase.paid_amount || 0).toLocaleString()} د.ج</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            {isAdmin && purchase.status !== 'paid' && (
                                                <button
                                                    onClick={() => setPaymentModalData(purchase)}
                                                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-bold shadow-sm"
                                                >
                                                    تسديد
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <>
                                                    <button
                                                        onClick={() => setEditModalData(purchase)}
                                                        className="px-3 py-1 bg-orange-50 text-orange-600 text-sm rounded hover:bg-orange-100 font-bold"
                                                    >
                                                        تعديل
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(purchase.id)}
                                                        className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 font-bold"
                                                        title="حذف الفاتورة"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => setDetailsModalData(purchase)}
                                                className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100 font-bold"
                                            >
                                                تفاصيل
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <NewPurchaseModal
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
                onSuccess={fetchPurchases}
            />

            <PurchasePaymentModal
                isOpen={!!paymentModalData}
                onClose={() => setPaymentModalData(null)}
                purchase={paymentModalData}
                onSuccess={fetchPurchases}
            />

            <PurchaseDetailsModal
                isOpen={!!detailsModalData}
                onClose={() => setDetailsModalData(null)}
                purchase={detailsModalData}
                onSuccess={fetchPurchases}
            />

            <EditPurchaseModal
                isOpen={!!editModalData}
                onClose={() => setEditModalData(null)}
                purchase={editModalData}
                onSuccess={fetchPurchases}
            />
        </div >
    );
}
