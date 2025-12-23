import { useRef, useEffect, useState } from "react";
import { X, ShoppingBag, Calendar, Package, Wallet, DollarSign, Trash2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import PrintablePurchaseInvoice from "./PrintablePurchaseInvoice";
import { supabase } from "../supabase";

export default function PurchaseDetailsModal({ isOpen, onClose, purchase, onSuccess }) {
    const [items, setItems] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const printRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `فاتورة شراء #${purchase?.id || ''}`,
    });

    useEffect(() => {
        if (isOpen && purchase) {
            fetchData();
        }
    }, [isOpen, purchase]); // eslint-disable-next-line react-hooks/exhaustive-deps

    async function fetchData() {
        setLoading(true);
        setLoadingPayments(true);

        const { data: itemsData, error: itemsError } = await supabase
            .from("purchase_items")
            .select("*, products(name)")
            .eq("purchase_id", purchase.id);

        if (itemsError) console.error("Error fetching purchase items:", itemsError);
        else setItems(itemsData || []);

        const { data: paymentsData, error: paymentsError } = await supabase
            .from("treasury_transactions")
            .select("*")
            .eq("category", "purchase_payment")
            .eq("reference_id", purchase.id)
            .order("created_at", { ascending: false });

        if (paymentsError) console.error("Error fetching payments:", paymentsError);
        else setPayments(paymentsData || []);

        setLoading(false);
        setLoadingPayments(false);
    }

    async function handleVoidPayment(transactionId) {
        if (!window.confirm("هل أنت متأكد من إلغاء هذه الدفعة؟ سيتم إرجاع المبلغ للمتبقي.")) return;

        const { error } = await supabase.rpc("void_purchase_payment", { p_transaction_id: transactionId });
        if (error) alert(error.message);
        else {
            fetchData();
            if (onSuccess) onSuccess();
        }
    }

    async function handleDeleteInvoice() {
        if (!window.confirm("تحذير خطير: هل أنت متأكد من حذف هذه الفاتورة بالكامل؟\n\n سيتم:\n1. حذف الفاتورة\n2. حذف جميع المدفوعات وتعديل الخزينة\n3. حذف المنتجات المرتبطة")) return;

        try {
            setLoading(true);

            // 1. Delete Installments/Items (Foreign Key Constraints usually cascade but let's be safe/explicit if needed)
            const { error: errItems } = await supabase.from("purchase_items").delete().eq("purchase_id", purchase.id);
            if (errItems) throw errItems;

            // 2. Delete Payments (Treasury Transactions)
            const { error: errPay } = await supabase.from("treasury_transactions")
                .delete()
                .eq("category", "purchase_payment")
                .eq("reference_id", purchase.id);

            if (errPay) throw errPay;

            // 3. Delete Purchase Record
            const { error: errPurchase } = await supabase.from("purchases").delete().eq("id", purchase.id);
            if (errPurchase) throw errPurchase;

            alert("تم حذف الفاتورة بنجاح.");
            onClose();
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error("Delete Error:", error);
            alert("حدث خطأ أثناء الحذف: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !purchase) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">

                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                                <ShoppingBag className="text-purple-600" />
                                تفاصيل الفاتورة #{purchase.id}
                            </h3>
                            <button
                                type="button"
                                onClick={handleDeleteInvoice}
                                className="bg-red-50 text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-100 flex items-center gap-1"
                            >
                                <Trash2 size={12} />
                                حذف الفاتورة
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
                            >
                                <Printer size={12} />
                                طباعة
                            </button>
                        </div>
                        <span className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar size={12} />
                            {new Date(purchase.created_at).toLocaleDateString("en-GB")}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                        <X size={22} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Status Banner */}
                    <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6">
                        <div>
                            <span className="block text-xs font-bold text-purple-600 mb-1">المورد</span>
                            <span className="font-bold text-gray-800 text-lg">
                                {purchase.suppliers ? `${purchase.suppliers.first_name} ${purchase.suppliers.last_name}` : "مورد محذوف"}
                            </span>
                        </div>
                        <div className="text-left">
                            <span className="block text-xs font-bold text-purple-600 mb-1">الإجمالي</span>
                            <span className="font-black text-purple-800 text-2xl">{purchase.total_amount.toLocaleString()} د.ج</span>
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                            <span className="text-xs font-bold text-green-600 block">المدفوع</span>
                            <span className="font-bold text-green-800 text-lg">{(purchase.paid_amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex-1 bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                            <span className="text-xs font-bold text-red-600 block">المتبقي</span>
                            <span className="font-bold text-red-800 text-lg">{(purchase.total_amount - (purchase.paid_amount || 0)).toLocaleString()}</span>
                        </div>
                    </div>

                    <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <Package size={18} />
                        المنتجات
                    </h4>

                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 font-bold text-gray-600">
                                <tr>
                                    <td className="p-3">المنتج</td>
                                    <td className="p-3">الكمية</td>
                                    <td className="p-3">سعر الشراء</td>
                                    <td className="p-3">الإجمالي</td>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan="4" className="p-4 text-center">جاري التحميل...</td></tr>
                                ) : items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="p-3 font-medium">{item.products?.name}</td>
                                        <td className="p-3">{item.quantity}</td>
                                        <td className="p-3">{item.unit_price.toLocaleString()}</td>
                                        <td className="p-3 font-bold">{(item.quantity * item.unit_price).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Payment History Section */}
                    <div className="mt-6 border-t border-gray-100 pt-4">
                        <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Wallet size={18} />
                            سجل الدفعات
                        </h4>
                        {loadingPayments ? (
                            <div className="text-gray-400 text-sm text-center py-2">جاري تحميل الدفعات...</div>
                        ) : payments.length === 0 ? (
                            <div className="text-gray-400 text-sm text-center py-2">لا توجد دفعات مسجلة</div>
                        ) : (
                            <div className="space-y-2">
                                {payments.map(pay => (
                                    <div key={pay.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-green-100 p-2 rounded-full text-green-600">
                                                <DollarSign size={16} />
                                            </div>
                                            <div>
                                                <span className="block font-bold text-gray-800">{pay.amount.toLocaleString()} د.ج</span>
                                                <span className="text-xs text-gray-500">{new Date(pay.created_at).toLocaleDateString("en-GB")}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleVoidPayment(pay.id)}
                                            title="إلغاء وتصحيح الدفعة"
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Hidden Printable Invoice */}
            <div style={{ display: "none" }}>
                <PrintablePurchaseInvoice
                    ref={printRef}
                    purchase={purchase}
                    items={items}
                />
            </div>
        </div> // Closes the fixed overlay
    );
}
