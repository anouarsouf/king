import { useEffect, useRef, useState } from "react";
import { X, Calendar, CheckCircle, Clock, AlertCircle, User, Printer, Trash2, FileText, Upload, Eye } from "lucide-react";


import { supabase } from "../supabase";
import PrintableSaleContract from "./PrintableSaleContract";

export default function SaleDetailsModal({ isOpen, onClose, sale, onSuccess }) {
    const [installments, setInstallments] = useState([]);
    const [saleItems, setSaleItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchedCustomer, setFetchedCustomer] = useState(null);
    const printRef = useRef();

    const handlePrint = () => {
        const printContent = printRef.current;
        const printWindow = window.open('', '', 'width=800,height=600');

        if (!printWindow) {
            alert("الرجاء السماح للنوافذ المنبثقة للطباعة");
            return;
        }

        printWindow.document.open();
        printWindow.document.write(`
            <html dir="rtl">
                <head>
                    <title>طباعة العقد</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { font-family: sans-serif; }
                        @media print {
                            .no-print { display: none; }
                            body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                            @page { size: A4; margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent ? printContent.innerHTML : '<h1>خطأ: لم يتم العثور على المحتوى</h1>'}
                    <script>
                        // Wait for Tailwind to process
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 1500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    async function handleDelete() {
        if (!window.confirm("تحذير: هل أنت متأكد من حذف هذه العملية؟ سيتم حذف جميع الأقساط المرتبطة بها.")) return;

        try {
            // 1. Delete Installments
            const { error: installError } = await supabase.from("installments").delete().eq("sale_id", sale.id);
            if (installError) throw installError;

            // 2. Delete Documents (if any)
            await supabase.from("sale_documents").delete().eq("sale_id", sale.id).catch(() => { });

            // 3. Delete Sale Items
            await supabase.from("sale_items").delete().eq("sale_id", sale.id);

            // 4. Delete Sale
            const { error } = await supabase.from("sales").delete().eq("id", sale.id);
            if (error) throw error;

            alert("تم الحذف بنجاح");
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            alert("خطأ في الحذف: " + error.message);
        }
    }

    useEffect(() => {
        if (isOpen && sale?.id) {
            fetchData();
        }
    }, [isOpen, sale]); // eslint-disable-next-line react-hooks/exhaustive-deps

    async function fetchData() {
        setLoading(true);
        try {
            // 0. Fetch Fresh Customer Data to ensure we have CCP
            if (sale.customer_id) {
                const { data: custData, error: custError } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("id", sale.customer_id)
                    .single();

                if (!custError && custData) {
                    setFetchedCustomer(custData);
                }
            }

            // Fetch Installments
            const { data: instData, error: instError } = await supabase
                .from("installments")
                .select("*")
                .eq("sale_id", sale.id)
                .order("due_date", { ascending: true });

            if (instError) console.error("Error fetching installments:", instError);
            setInstallments(instData || []);

            // Fetch Sale Items
            const { data: itemsData } = await supabase
                .from("sale_items")
                .select("*, products(name)")
                .eq("sale_id", sale.id);
            setSaleItems(itemsData || []);

            // [NEW] Fetch Branch Details if linked
            if (sale.branch_id) {
                const { data: branchData } = await supabase
                    .from("branches")
                    .select("*")
                    .eq("id", sale.branch_id)
                    .single();

                if (branchData) {
                    // We can attach this to the sale object or a separate state
                    sale.branch = branchData; // Mutating prop clone effectively for this scope
                }
            } else {
                sale.branch = null; // Ensure reset
            }

        } catch (error) {
            console.error("Critical error in fetchData:", error);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !sale) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 no-print">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <FileText className="text-indigo-600" />
                        ملف البيع #{sale.id}
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDelete}
                            className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                            title="حذف العملية"
                        >
                            <Trash2 size={20} />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-2 px-4 shadow-sm border border-blue-200"
                            title="طباعة العقد"
                        >
                            <Printer size={20} />
                            <span className="font-bold text-sm">طباعة العقد</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="space-y-6">

                        {/* Main Content (Left Column) */}
                        <div className="space-y-6">

                            {/* Customer Info Card */}
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100/50 rounded-full text-blue-600">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">
                                            {(fetchedCustomer || sale.customers)?.first_name} {(fetchedCustomer || sale.customers)?.last_name}
                                        </h4>
                                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                                            {(fetchedCustomer || sale.customers)?.phone || "لا يوجد رقم هاتف"}
                                        </p>
                                    </div>
                                </div>

                                {(fetchedCustomer || sale.customers)?.ccp_number && (
                                    <div className="text-left px-4 py-1.5 bg-white border border-blue-100 rounded-lg shadow-sm">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">رقم الحساب البريدي (CCP)</p>
                                        <p className="text-sm font-mono font-bold text-gray-700 dir-ltr">
                                            {(fetchedCustomer || sale.customers).ccp_number} <span className="text-gray-300 mx-1">/</span> {(fetchedCustomer || sale.customers).ccp_key || "--"}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="text-gray-500 text-xs font-bold uppercase block mb-1">المبلغ الإجمالي</span>
                                    <div className="text-xl font-black text-gray-800">{sale.total_amount?.toLocaleString()} <span className="text-xs text-gray-400">د.ج</span></div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="text-green-600 text-xs font-bold uppercase block mb-1">المدفوع</span>
                                    <div className="text-xl font-black text-green-700">{sale.paid_amount?.toLocaleString()} <span className="text-xs text-green-200">د.ج</span></div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="text-red-500 text-xs font-bold uppercase block mb-1">المتبقي</span>
                                    <div className="text-xl font-black text-red-700">
                                        {(sale.total_amount - sale.paid_amount)?.toLocaleString()} <span className="text-xs text-red-200">د.ج</span>
                                    </div>
                                </div>
                            </div>

                            {/* Sale Items (Products) moved to top */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <h4 className="p-4 font-bold text-gray-700 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                                    <CheckCircle size={18} className="text-gray-500" />
                                    المنتجات المباعة
                                </h4>
                                {saleItems.length > 0 ? (
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 font-bold">
                                            <tr>
                                                <th className="p-3">المنتج</th>
                                                <th className="p-3">الكمية</th>
                                                <th className="p-3">السعر</th>
                                                <th className="p-3">الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {saleItems.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800">{item.products?.name || "منتج"}</td>
                                                    <td className="p-3">{item.quantity}</td>
                                                    <td className="p-3">{item.unit_price.toLocaleString()}</td>
                                                    <td className="p-3 font-bold">{(item.quantity * item.unit_price).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-gray-500">
                                        <p className="font-bold text-gray-700 mb-1">{sale.product_names || "لا توجد تفاصيل للمنتجات"}</p>
                                        <p className="text-xs text-gray-400">
                                            (هذا العقد قديم ولم يتم تسجيل تفاصيل المنتجات فيه بشكل منفصل، أو تم حذفها)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Installments Table */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <h4 className="p-4 font-bold text-gray-700 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                                    <Calendar size={18} className="text-gray-500" />
                                    جدول الأقساط (ملخص شهري)
                                </h4>

                                {sale.sale_type === 'cash' ? (
                                    <div className="text-center py-8 text-gray-500">
                                        هذا بيع نقدي (كاش) - لا توجد أقساط.
                                    </div>
                                ) : loading ? (
                                    <div className="text-center py-8 text-gray-500">جاري تحميل الأقساط...</div>
                                ) : installments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">لا توجد أقساط مسجلة.</div>
                                ) : (
                                    <table className="w-full text-right">
                                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-medium">
                                            <tr>
                                                <th className="p-3">#</th>
                                                <th className="p-3">التاريخ</th>
                                                <th className="p-3">المبلغ الشهري</th>
                                                <th className="p-3">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {/* GROUP BY MONTH LOGIC */}
                                            {Object.values(installments.reduce((acc, curr) => {
                                                const dateKey = curr.due_date;
                                                if (!acc[dateKey]) {
                                                    acc[dateKey] = {
                                                        ...curr,
                                                        amount: 0,
                                                        originalIds: []
                                                    };
                                                }
                                                acc[dateKey].amount += parseFloat(curr.amount);
                                                acc[dateKey].originalIds.push(curr.id);
                                                // If any part is NOT paid, the whole month is considered NOT paid (simplified)
                                                // Or better: if ALL are paid -> paid.
                                                if (acc[dateKey].is_paid && !curr.is_paid) acc[dateKey].is_paid = false;

                                                return acc;
                                            }, {})).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map((inst, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800">#{index + 1}</td>
                                                    <td className="p-3 text-gray-600 font-mono">
                                                        {new Date(inst.due_date).toLocaleDateString("en-GB")}
                                                    </td>
                                                    <td className="p-3 font-bold text-gray-800">
                                                        {inst.amount.toLocaleString()} <span className="text-xs text-gray-400">({inst.originalIds.length} مراجع)</span>
                                                    </td>
                                                    <td className="p-3">
                                                        {inst.is_paid ? (
                                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">مدفوع بالكامل</span>
                                                        ) : (
                                                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">غير مدفوع</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Hidden Printable Component */}
            <div ref={printRef} style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
                <PrintableSaleContract
                    sale={{ ...sale, customers: fetchedCustomer || sale.customers }}
                    installments={Object.values(installments.reduce((acc, curr) => {
                        const dateKey = curr.due_date;
                        if (!acc[dateKey]) { acc[dateKey] = { ...curr, amount: 0 }; }
                        acc[dateKey].amount += parseFloat(curr.amount);
                        return acc;
                    }, {})).sort((a, b) => new Date(a.due_date) - new Date(b.due_date))}
                    saleItems={saleItems}
                    // [NEW] Dynamic Company Info
                    companyName={sale.branch?.name || "مؤسسة التقسيط برو"}
                    companyAddress={sale.branch?.address || (sale.branch?.location ? `${sale.branch?.wilaya || ''} - ${sale.branch?.location}` : "الجزائر العاصمة")}
                    companyPhone={sale.branch?.phone || "0550 00 00 00"}
                />
            </div>
        </div>
    );
}
