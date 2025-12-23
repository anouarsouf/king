import { forwardRef } from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

const PrintablePurchaseInvoice = forwardRef(({ purchase, items, companyName = "مؤسسة التقسيط برو", companyAddress = "الجزائر العاصمة", companyPhone = "0550 00 00 00" }, ref) => {
    if (!purchase) return null;

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
                        فاتورة شراء
                    </h2>
                    <p className="text-xs font-mono mt-1 text-gray-500">رقم: #{purchase.id.toString().padStart(6, '0')}</p>
                    <p className="text-xs font-mono text-gray-500">التاريخ: {new Date(purchase.created_at).toLocaleDateString("en-GB")}</p>
                </div>
            </div>

            {/* Supplier Info */}
            <div className="mb-4 p-3 border border-gray-300 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center text-sm">
                    <div>
                        <span className="text-gray-500 ml-2">المورد:</span>
                        <span className="font-bold">
                            {purchase.suppliers ? `${purchase.suppliers.first_name} ${purchase.suppliers.last_name}` : "مورد غير محدد"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-4">
                <table className="w-full border-collapse border border-gray-300 text-xs text-right">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 p-2 w-10 text-center">#</th>
                            <th className="border border-gray-300 p-2">المنتج</th>
                            <th className="border border-gray-300 p-2 w-20 text-center">الكمية</th>
                            <th className="border border-gray-300 p-2 w-32">سعر الوحدة</th>
                            <th className="border border-gray-300 p-2 w-32">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items && items.length > 0 ? (
                            items.map((item, index) => (
                                <tr key={index}>
                                    <td className="border border-gray-300 p-2 text-center bg-gray-50">{index + 1}</td>
                                    <td className="border border-gray-300 p-2 font-medium">{item.products?.name}</td>
                                    <td className="border border-gray-300 p-2 text-center">{item.quantity}</td>
                                    <td className="border border-gray-300 p-2 font-mono">{item.unit_price?.toLocaleString()}</td>
                                    <td className="border border-gray-300 p-2 font-mono font-bold">{(item.quantity * item.unit_price)?.toLocaleString()}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="border border-gray-300 p-4 text-center text-gray-500">لا توجد منتجات</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end mb-8">
                <div className="w-1/2 border border-gray-300 rounded-lg overflow-hidden">
                    <div className="flex justify-between p-2 border-b border-gray-300 bg-gray-50">
                        <span className="text-sm font-bold">المجموع الإجمالي:</span>
                        <span className="text-sm font-black text-gray-800">{purchase.total_amount?.toLocaleString()} د.ج</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-gray-300">
                        <span className="text-sm text-gray-600">المدفوع:</span>
                        <span className="text-sm font-bold text-green-700">{purchase.paid_amount?.toLocaleString()} د.ج</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-100">
                        <span className="text-sm font-bold text-gray-800">المتبقي:</span>
                        <span className="text-sm font-black text-red-700">{(purchase.total_amount - purchase.paid_amount)?.toLocaleString()} د.ج</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-dashed border-gray-400">
                <div className="flex justify-between items-start text-center h-20 text-xs">
                    <div className="w-1/3">
                        <p className="font-bold mb-2 underline">توقيع المورد</p>
                    </div>
                    <div className="w-1/3">
                        <p className="font-bold mb-2 underline">ختم وتوقيع المستلم</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default PrintablePurchaseInvoice;
