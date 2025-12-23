import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../supabase';

export default function PostalExport() {
    const [loading, setLoading] = useState(false);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    async function handleExport() {
        setLoading(true);
        try {
            // 1. Fetch Installments for the selected month with linked Reference & Customer
            // We need installments that are 'pending' (or maybe all?) for this month.
            // And we specifically need the Reference details.

            const targetDatePrefix = month; // "2025-01"

            const { data: installments, error } = await supabase
                .from("installments")
                .select(`
                    amount,
                    due_date,
                    reference_id,
                    payment_references (
                        reference_code,
                        start_month,
                        end_month
                    ),
                    sales (
                        customer_id,
                        customers (
                            first_name,
                            last_name,
                            ccp_number,
                            ccp_key
                        ),
                        contracts (
                            withdrawal_day
                        )
                    )
                `)
                .ilike("due_date", `${targetDatePrefix}%`) // Filter by month
                .not("reference_id", "is", null); // Only CCP installments

            if (error) throw error;
            if (!installments || installments.length === 0) {
                alert("لا توجد اقتطاعات بريدية مسجلة لهذا الشهر.");
                setLoading(false);
                return;
            }

            // 2. Format Data for Excel
            // Format: CompteA | cleA | NOM | PRENOM | MontantVo | CompteB | CleB | DateDebut | DateFin | DateCeation | MoisTraite | Nbrecheance | JourPrel | Reference

            const excelData = installments.map(inst => {
                const customer = inst.sales?.customers || {};
                const reference = inst.payment_references || {};
                const contract = inst.sales?.contracts || {};

                // Defaults for Company Account (CompteB) - Placeholder
                const COMPANY_CCP = "00000000";
                const COMPANY_KEY = "00";

                return {
                    "CompteA": customer.ccp_number || "MISSING",
                    "cleA": customer.ccp_key || "00",
                    "NOM": customer.last_name || "",
                    "PRENOM": customer.first_name || "",
                    "MontantVo": inst.amount,
                    "CompteB": COMPANY_CCP,
                    "CleB": COMPANY_KEY,
                    "DateDebut": formatDate(reference.start_month),
                    "DateFin": formatDate(reference.end_month),
                    "DateCeation": formatDate(reference.start_month), // As per prompt
                    "MoisTraite": month, // "2025-01"
                    "Nbrecheance": 1, // Usually 1 per line? Or total months? Leaving 1 for row.
                    "JourPrel": contract.withdrawal_day || 1,
                    "Reference": reference.reference_code || "MISSING"
                };
            });

            // 3. Generate File
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Postal Withdrawals");

            XLSX.writeFile(wb, `Prélèvements_${month}.xlsx`);

        } catch (err) {
            console.error(err);
            alert("خطأ في التصدير: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Helper: YYYY-MM-DD -> DD/MM/YYYY
    function formatDate(isoStr) {
        if (!isoStr) return "";
        const [y, m, d] = isoStr.split('-');
        return `${d}/${m}/${y}`;
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <FileSpreadsheet className="text-green-600" />
                تصدير ملف البريد (Excel)
            </h3>

            <div className="flex items-center gap-4">
                <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="p-2 border rounded-lg"
                />

                <button
                    onClick={handleExport}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all"
                >
                    <Download size={18} />
                    {loading ? "جاري التصدير..." : "تحميل ملف Excel"}
                </button>
            </div>
            <p className="text-xs text-gray-500">
                يقوم بتصدير جميع الاقتطاعات المستحقة للشهر المحدد، بتنسيق CCP الرسمي.
            </p>
        </div>
    );
}
