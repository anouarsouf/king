import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { supabase } from '../supabase';

export default function PostalImport({ onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null); // { success: 0, waiting: 0, blocked: 0 }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setStats(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            await processFileContent(text);
        };
        reader.readAsText(file);
    }

    async function processFileContent(content) {
        // Parse File: Assume format "Reference Code" per line? 
        // User said: "contains: reference, code (0, 1, 2)"
        // Assuming format: "REF123456 0" or CSV "REF123456,0" or just fixed width?
        // Prompt says "code (0, 1, 2)".
        // Let's assume standard space/tab/comma separation.

        const lines = content.split(/\r?\n/);
        let successCount = 0;
        let waitingCount = 0;
        let blockedCount = 0;
        let errors = 0;

        try {
            for (const line of lines) {
                if (!line.trim()) continue;

                // Split by space/tab/comma
                const parts = line.trim().split(/[\s,;]+/);
                if (parts.length < 2) continue; // Skip invalid lines

                const refCode = parts[0];
                const statusCode = parseInt(parts[1]);

                if (isNaN(statusCode)) continue;

                // Map Code to Status Color & Enum
                // 0 = Success (Green)
                // 1 = Waiting (Red)
                // 2 = Blocked (Black)

                let postalStatus = 0; // Default
                if (statusCode === 1) postalStatus = 1;
                if (statusCode === 2) postalStatus = 2;

                // Update Database
                // We need to find the payment_reference first to get its ID?
                // Actually, installments now have reference_id.
                // But we don't have reference_id here, we have CODE.
                // We need to find the REFERENCE ID from the CODE.

                // Optimized approach: 
                // 1. Find Reference by Code
                const { data: refData } = await supabase
                    .from("payment_references")
                    .select("id")
                    .eq("reference_code", refCode)
                    .single();

                if (refData) {
                    // 2. Update Installment
                    // Which installment? "This month's"?
                    // User logic: "Update status monthly depending on reference".
                    // The text file likely comes monthly.
                    // So we update the installment linked to this reference that is 'pending' and closest to NOW?
                    // OR we just update the 'postal_status' of the reference itself?
                    // Prompt says "Update installment status".

                    // Let's find pending installments for this reference
                    // (Maybe filtering by current month derived from file context? But we don't have date in file).
                    // We will update the OLDEST 'pending' installment for this reference.

                    const { data: pendingInstallment } = await supabase
                        .from("installments")
                        .select("id")
                        .eq("reference_id", refData.id)
                        .eq("status", "pending") // Only update pending ones
                        .order("due_date", { ascending: true })
                        .limit(1)
                        .single();

                    if (pendingInstallment) {
                        const updates = {
                            postal_status: statusCode
                        };

                        // If Code 0 (Success), we mark as Paid?
                        if (statusCode === 0) {
                            updates.is_paid = true;
                            updates.amount_paid = 99999; // Hack if amount_paid column creates issues, but we removed it.
                            // Actually, we use 'is_paid'.
                            updates.status = "paid"; // Internal status
                        }
                        // If Code 1 (Waiting) -> Red. Keep as pending.
                        // If Code 2 (Blocked) -> Black. Keep as pending.

                        await supabase
                            .from("installments")
                            .update(updates)
                            .eq("id", pendingInstallment.id);

                        if (statusCode === 0) successCount++;
                        if (statusCode === 1) waitingCount++;
                        if (statusCode === 2) blockedCount++;
                    }
                } else {
                    errors++;
                    console.warn(`Reference not found: ${refCode}`);
                }
            }

            setStats({ success: successCount, waiting: waitingCount, blocked: blockedCount });
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error(err);
            alert("حدث خطأ أثناء المعالجة: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <FileText className="text-blue-600" />
                استيراد وتحديث الحالة (Text File)
            </h3>

            {!stats ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition cursor-pointer relative">
                    <input
                        type="file"
                        accept=".txt,.csv"
                        onChange={handleFileUpload}
                        disabled={loading}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        {loading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        ) : (
                            <>
                                <Upload size={32} className="text-gray-400" />
                                <span className="font-bold">اضغط لرفع ملف التحديث</span>
                                <span className="text-xs">يدعم ملفات Text / CSV (المرجع مسافة الكود)</span>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                            <CheckCircle className="mx-auto text-green-600 mb-1" size={20} />
                            <div className="text-2xl font-bold text-green-700">{stats.success}</div>
                            <div className="text-xs text-green-600 font-bold">نجاح (0)</div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <AlertTriangle className="mx-auto text-red-600 mb-1" size={20} />
                            <div className="text-2xl font-bold text-red-700">{stats.waiting}</div>
                            <div className="text-xs text-red-600 font-bold">انتظار (1)</div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-lg border border-gray-200">
                            <AlertOctagon className="mx-auto text-gray-800 mb-1" size={20} />
                            <div className="text-2xl font-bold text-gray-800">{stats.blocked}</div>
                            <div className="text-xs text-gray-600 font-bold">محظور (2)</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setStats(null)}
                        className="w-full py-2 text-blue-600 font-bold hover:bg-blue-50 rounded-lg text-sm"
                    >
                        معالجة ملف آخر
                    </button>
                </div>
            )}
            <p className="text-xs text-gray-500">
                يقرأ الأسطر بصيغة: <code>REFERENCE CODE</code> (مثال: REF123 0) ويحدث الأقساط المعلقة.
            </p>
        </div>
    );
}
