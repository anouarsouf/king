import { useEffect, useState } from "react";
import { Plus, Search, Printer, FileText, Phone, User as UserIcon, Edit, Trash2, LayoutGrid, List as ListIcon, AlertTriangle, CheckCircle, Clock, ShieldAlert } from "lucide-react";
import { supabase } from "../supabase";
import CustomerModal from "../components/CustomerModal";

export default function Customers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState(null);
    const [displayMode, setDisplayMode] = useState("list"); // 'grid' or 'list'

    useEffect(() => {
        fetchCustomers();
    }, []);

    async function fetchCustomers() {
        setLoading(true);
        try {
            // 1. Fetch Customers (Simple)
            const { data: customersData, error: custError } = await supabase
                .from("customers")
                .select("*")
                .order("created_at", { ascending: false });

            if (custError) throw custError;

            // 2. Fetch ALL Installments (for Risk Calculation)
            // 2. Fetch ALL Installments (for Risk Calculation)
            // Using *, plus explicitly joining sales to get customer_id
            const { data: installmentsData, error: instError } = await supabase
                .from("installments")
                .select("*, sales(customer_id)");

            if (instError) throw instError;

            // 3. Process Risk in Memory
            const riskMap = {}; // customer_id -> { overdueCount, totalOverdueAmount }
            const today = new Date().toISOString().split('T')[0];

            installmentsData?.forEach(inst => {
                const customerId = inst.sales?.customer_id;
                if (!customerId) return;

                if (!riskMap[customerId]) {
                    riskMap[customerId] = { count: 0, amount: 0 };
                }

                // Check Overdue Logic (Using is_paid boolean)
                if (inst.due_date < today && !inst.is_paid) {
                    riskMap[customerId].count++;
                    riskMap[customerId].amount += inst.amount; // Assume full amount is overdue if not paid
                }
            });

            // 4. Merge Data
            const processedCustomers = (customersData || []).map(customer => {
                const riskStats = riskMap[customer.id] || { count: 0, amount: 0 };
                const riskProfile = calculateRisk(riskStats.count);
                return { ...customer, riskProfile, riskStats };
            });

            setCustomers(processedCustomers);

        } catch (error) {
            console.error("Error fetching customers:", error);
            alert("حدث خطأ أثناء تحميل البيانات: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    // --- Risk Rules Helper ---
    function calculateRisk(overdueCount) {
        let level = 'SAFE';
        let label = 'منتظم';
        let color = 'bg-emerald-100 text-emerald-700';
        let alert = null;
        let score = 100 - (overdueCount * 15);
        if (score < 0) score = 0;

        if (overdueCount >= 2) {
            level = 'CRITICAL';
            label = 'متعثر جداً';
            color = 'bg-red-100 text-red-700';
            alert = "⚠️ يجب تجديد العقد / إجراء قانوني";
        } else if (overdueCount === 1) {
            level = 'WARNING';
            label = 'تأخر بسيط';
            color = 'bg-amber-100 text-amber-700';
            alert = "يرجى التذكير بالدفع";
        }

        return { level, score, overdueCount, label, color, alert };
    }

    function handleAdd() {
        setCustomerToEdit(null);
        setIsModalOpen(true);
    }

    function handleEdit(customer) {
        setCustomerToEdit(customer);
        setIsModalOpen(true);
    }

    async function handleDelete(id) {
        if (!window.confirm("هل أنت متأكد من حذف هذا الزبون؟")) return;

        // Check for sales
        const { data: sales } = await supabase.from("sales").select("id").eq("customer_id", id);

        if (sales && sales.length > 0) {
            if (!window.confirm(`تنبيه: هذا الزبون لديه ${sales.length} عقود بيع مسجلة. \nهل أنت متأكد من رغبتك في حذف الزبون وجميع مبيعاته وأقساطه نهائياً؟`)) return;

            try {
                const saleIds = sales.map(s => s.id);
                // 1. Delete Installments for these sales
                const { error: err1 } = await supabase.from("installments").delete().in("sale_id", saleIds);
                if (err1) throw err1;

                // 2. Delete Payments (Treasury Transactions)
                const { error: errPay } = await supabase.from("treasury_transactions")
                    .delete()
                    .in("reference_id", saleIds)
                    .in("category", ["sale_payment", "down_payment", "installment_payment"]);
                if (errPay) throw errPay;

                // 3. Delete Sales
                const { error: err2 } = await supabase.from("sales").delete().in("id", saleIds);
                if (err2) throw err2;
            } catch (err) {
                alert("حدث خطأ أثناء حذف بيانات الزبون المرتبطة: " + err.message);
                return;
            }
        }

        // 3. Delete Customer
        const { error } = await supabase.from("customers").delete().eq("id", id);

        if (error) {
            alert("خطأ في حذف الزبون: " + error.message);
        } else {
            fetchCustomers();
        }
    }

    function handleSuccess() {
        fetchCustomers(); // Refresh list
    }

    const filteredCustomers = customers.filter((customer) =>
        (customer.first_name + " " + customer.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.ccp_number?.includes(searchTerm) ||
        customer.phone?.includes(searchTerm)
    );

    // Sort: Critical Customers First!
    const sortedCustomers = filteredCustomers.sort((a, b) => {
        // Priority to 'CRITICAL' (level 3?), then 'WARNING' (2), then 'SAFE' (1)
        const getRank = (c) => c.riskProfile?.level === 'CRITICAL' ? 3 : c.riskProfile?.level === 'WARNING' ? 2 : 1;
        return getRank(b) - getRank(a);
    });

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <UserIcon className="text-blue-600" />
                    إدارة الزبائن (Risk Profiling)
                </h2>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="بحث بالاسم أو الهاتف أو CCP..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setDisplayMode(displayMode === 'list' ? 'grid' : 'list')}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg bg-white border"
                        title={displayMode === 'list' ? "عرض الشبكة" : "عرض القائمة"}
                    >
                        {displayMode === 'list' ? <LayoutGrid size={20} /> : <ListIcon size={20} />}
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={18} />
                        إضافة زبون
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">جاري تحميل الزبائن...</div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">لا يوجد زبائن حالياً.</div>
            ) : displayMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedCustomers.map((customer) => (
                        <div key={customer.id} className={`bg-white p-6 rounded-xl shadow-sm border relative overflow-hidden group hover:shadow-md transition-shadow ${customer.riskProfile?.level === 'CRITICAL' ? 'border-red-200' : 'border-gray-100'}`}>
                            {/* Risk Badge (Top Left for uniqueness) */}
                            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-xs font-bold ${customer.riskProfile?.color}`}>
                                {customer.riskProfile?.label} ({customer.riskProfile?.score}%)
                            </div>

                            <div className="flex items-center gap-4 mb-4 mt-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${customer.riskProfile?.level === 'CRITICAL' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {customer.first_name[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{customer.first_name} {customer.last_name}</h3>
                                    <p className="text-sm text-gray-500">{customer.phone}</p>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-gray-400" />
                                    <span>CCP: {customer.ccp_number || "غير متوفر"}</span>
                                </div>
                                {customer.riskProfile?.overdueCount > 0 && (
                                    <div className="flex items-center gap-2 text-red-600 font-medium bg-red-50 p-2 rounded-lg">
                                        <AlertTriangle size={16} />
                                        <span>عليه {customer.riskProfile?.overdueCount} أقساط متأخرة</span>
                                    </div>
                                )}
                                {customer.riskProfile?.alert && (
                                    <div className="bg-orange-50 text-orange-800 text-xs p-2 rounded border border-orange-100 flex items-start gap-2 animate-pulse">
                                        <ShieldAlert size={14} className="mt-0.5" />
                                        {customer.riskProfile?.alert}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <button onClick={() => handleEdit(customer)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button>
                                <button onClick={() => handleDelete(customer.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">الاسم</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">الهاتف</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">CCP</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600">الحالة (Risk)</th>
                                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedCustomers.map((customer) => (
                                <tr key={customer.id} className={`hover:bg-gray-50 transition-colors ${customer.riskProfile?.level === 'CRITICAL' ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-6 py-4 font-medium text-gray-800">{customer.first_name} {customer.last_name}</td>
                                    <td className="px-6 py-4 text-gray-600">{customer.phone}</td>
                                    <td className="px-6 py-4 text-gray-600 font-mono">{customer.ccp_number || "-"}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.riskProfile?.color}`}>
                                                {customer.riskProfile?.label} ({customer.riskProfile?.score}%)
                                            </span>
                                            {customer.riskProfile?.alert && (
                                                <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                                    <AlertTriangle size={10} /> {customer.riskProfile?.alert}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleEdit(customer)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(customer.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                customerToEdit={customerToEdit}
            />
        </div>
    );
}
