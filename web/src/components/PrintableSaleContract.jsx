import { forwardRef } from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

const PrintableSaleContract = forwardRef(({ sale, installments, saleItems, companyName = "مؤسسة التقسيط برو", companyAddress = "الجزائر العاصمة", companyPhone = "0550 00 00 00" }, ref) => {
    if (!sale) return null;

    return (
        <div ref={ref} className="bg-white text-black font-sans dir-rtl leading-tight mx-auto" style={{ direction: "rtl", width: "100%", maxWidth: "210mm", minHeight: "297mm", padding: "10mm", boxSizing: "border-box" }}>
            {/* Header */}
            <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold mb-1">{companyName}</h1>
                    <p className="text-xs text-gray-600">{companyAddress}</p>
                    <p className="text-xs text-gray-600">هاتف: {companyPhone}</p>
                </div>
                <div className="text-left">
                    <h2 className="text-lg font-black uppercase tracking-wide border-2 border-black px-3 py-1 rounded-lg">
                        {sale.sale_type === 'installment' ? 'عقد بيع بالتقسيط' : 'فاتورة بيع'}
                    </h2>
                    <p className="text-xs font-mono mt-1 text-gray-500">رقم: #{sale.id.toString().padStart(6, '0')}</p>
                    <p className="text-xs font-mono text-gray-500">التاريخ: {new Date(sale.created_at).toLocaleDateString("en-GB")}</p>
                </div>
            </div>

            {/* Customer Info - Compact */}
            <div className="mb-4 p-3 border border-gray-300 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center text-sm">
                    <div>
                        <span className="text-gray-500 ml-2">العميل:</span>
                        <span className="font-bold">
                            {sale.customers ? `${sale.customers.first_name} ${sale.customers.last_name}` : sale.customer_name}
                        </span>
                    </div>
                    <div>
                        <span className="text-gray-500 ml-2">الهاتف:</span>
                        <span className="font-mono">{sale.customers?.phone || "غير مسجل"}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 ml-2">CCP:</span>
                        <span className="font-mono">
                            {sale.customers?.ccp_number ? `${sale.customers.ccp_number} / ${sale.customers.ccp_key || "--"}` : "---"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Products Table - Detailed */}
            <div className="mb-4">
                <table className="w-full border-collapse border border-gray-300 text-xs text-right">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 p-1">المنتج</th>
                            <th className="border border-gray-300 p-1 w-16 text-center">الكمية</th>
                            <th className="border border-gray-300 p-1 w-24">السعر</th>
                            <th className="border border-gray-300 p-1 w-32">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {saleItems && saleItems.length > 0 ? (
                            saleItems.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="border border-gray-300 p-1 font-bold">{item.products?.name || item.product_name || "منتج"}</td>
                                    <td className="border border-gray-300 p-1 text-center">{item.quantity}</td>
                                    <td className="border border-gray-300 p-1 text-center">{item.unit_price?.toLocaleString()}</td>
                                    <td className="border border-gray-300 p-1 font-mono font-bold">{(item.quantity * item.unit_price)?.toLocaleString()}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td className="border border-gray-300 p-1 font-bold">{sale.product_names || "منتج غير محدد"}</td>
                                <td className="border border-gray-300 p-1 text-center">{sale.quantity || 1}</td>
                                <td className="border border-gray-300 p-1 text-center">-</td>
                                <td className="border border-gray-300 p-1 font-mono font-bold">{sale.total_amount?.toLocaleString()} د.ج</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Financial Summary - Row Layout */}
            <div className="flex justify-between items-center mb-4 border border-gray-300 rounded p-2 bg-gray-50 text-xs">
                <div>
                    <span className="text-gray-500">المبلغ الإجمالي:</span>
                    <span className="font-bold mr-2">{sale.total_amount?.toLocaleString()} د.ج</span>
                </div>
                <div>
                    <span className="text-gray-500">المدفوع (عربون):</span>
                    <span className="font-bold text-green-700 mr-2">{sale.paid_amount?.toLocaleString()} د.ج</span>
                </div>
                <div>
                    <span className="text-gray-500">المتبقي:</span>
                    <span className="font-black text-red-700 mr-2">{(sale.total_amount - sale.paid_amount)?.toLocaleString()} د.ج</span>
                </div>
            </div>

            {/* Installment Schedule - Compact Grid */}
            {sale.sale_type === 'installment' && installments && installments.length > 0 && (
                <div className="mb-4">
                    <h3 className="font-bold text-sm mb-1 bg-gray-100 p-1 rounded">جدول الأقساط</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                        {/* We can split table into two columns if needed, or just keep it small */}
                        <table className="col-span-2 w-full border-collapse border border-gray-300 text-xs text-right">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="border border-gray-300 p-1 w-10 text-center">#</th>
                                    <th className="border border-gray-300 p-1">تاريخ الاستحقاق</th>
                                    <th className="border border-gray-300 p-1">المبلغ</th>
                                    <th className="border border-gray-300 p-1 text-center text-gray-400">الإمضاء / ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {installments.map((inst, idx) => (
                                    <tr key={inst.id}>
                                        <td className="border border-gray-300 p-1 text-center bg-gray-50">{idx + 1}</td>
                                        <td className="border border-gray-300 p-1 font-mono">{new Date(inst.due_date).toLocaleDateString("en-GB")}</td>
                                        <td className="border border-gray-300 p-1 font-mono font-bold">{inst.amount.toLocaleString()}</td>
                                        <td className="border border-gray-300 p-1"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Terms & Signatures - Footer */}
            <div className="mt-auto pt-4 border-t border-dashed border-gray-400">
                <p className="text-[10px] text-justify mb-4 leading-normal text-gray-600">
                    أتعهد أنا الموقع أدناه، بصحة المعلومات الواردة أعلاه وبالتزامي بدفع الأقساط المصرح بها في تواريخ استحقاقها.
                    وفي حالة التأخر عن الدفع، يحق للمؤسسة اتخاذ الإجراءات القانونية اللازمة.
                    يعتبر هذا المستند إثباتاً رسمياً للدين المستحق.
                </p>

                <div className="flex justify-between items-start text-center h-20 text-xs">
                    <div className="w-1/3">
                        <p className="font-bold mb-2 underline">توقيع وختم المؤسسة</p>
                    </div>
                    <div className="w-1/3">
                        <p className="font-bold mb-2 underline">توقيع العميل (المشتري)</p>
                        <p className="text-[10px] text-gray-400 mt-4">(قرأت ووافقت)</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default PrintableSaleContract;
