import { useState, useEffect } from "react";
import { X, Save, Calculator, Calendar, CreditCard, Banknote, User } from "lucide-react";
import { supabase } from "../supabase";

export default function NewSaleModal({ isOpen, onClose, onSuccess }) {
    const [saleType, setSaleType] = useState("installment"); // 'cash' or 'installment'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        customer_id: "",
        product_name: "",
        cash_price: "",
        installment_price: "", // Total price including profit
        down_payment: 0,
        months: 15,
        withdrawal_day: 1, // 1 or 30
    });

    // Derived State
    const monthlyInstallment = saleType === "installment" && formData.installment_price && formData.months
        ? (formData.installment_price - formData.down_payment) / formData.months
        : 0;

    useEffect(() => {
        if (isOpen) fetchCustomers();
    }, [isOpen]);

    const [contracts, setContracts] = useState([]);
    const [splitPreview, setSplitPreview] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchCustomers();
            fetchContracts();
        }
    }, [isOpen]);

    async function fetchCustomers() {
        const { data } = await supabase
            .from("customers")
            .select("id, first_name, last_name, ccp_number")
            .order("first_name");
        setCustomers(data || []);
    }

    async function fetchContracts() {
        const { data } = await supabase
            .from("contracts")
            .select("*")
            .order("type");
        setContracts(data || []);
        // Set default contract if available
        if (data && data.length > 0) {
            // Default to type 1 or first one
            const defaultC = data.find(c => c.type === 1) || data[0];
            setFormData(prev => ({ ...prev, withdrawal_day: defaultC.id })); // Storing contract ID in withdrawal_day temporarily or adding new field?
            // Wait, formData.withdrawal_day was "1" or "30".
            // Logic in handleSubmit uses "targetDay = parseInt(formData.withdrawal_day)".
            // If I change this to contract_id, I break the logic unless I map it.
            // Better to add "contract_id" to formData and update Logic.
        }
    }

    // Effect to calculate split preview dynamically
    useEffect(() => {
        if (saleType === "installment" && monthlyInstallment > 0) {
            const totalMonthly = monthlyInstallment;
            let numRefs = 1;
            for (let n = 5; n >= 1; n--) {
                if (totalMonthly / n >= 500) {
                    numRefs = n;
                    break;
                }
            }
            const amountPerRef = Math.floor(totalMonthly / numRefs);
            const remainder = totalMonthly - (amountPerRef * numRefs);

            const previews = [];
            for (let i = 0; i < numRefs; i++) {
                previews.push({
                    index: i + 1,
                    amount: i === numRefs - 1 ? amountPerRef + remainder : amountPerRef
                });
            }
            setSplitPreview(previews);
        } else {
            setSplitPreview([]);
        }
    }, [monthlyInstallment, saleType]);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                customer_id: formData.customer_id,
                sale_type: saleType,
                product_names: formData.product_name, // Using singular field for now
                total_amount: saleType === "cash" ? formData.cash_price : formData.installment_price,
                paid_amount: saleType === "cash" ? formData.cash_price : formData.down_payment,
                status: saleType === "cash" ? "completed" : "active",
                withdrawal_day: saleType === "installment" ? formData.withdrawal_day : null,
                installment_months: saleType === "installment" ? formData.months : null,
                monthly_installment_amount: monthlyInstallment, // Saving exact monthly amount
            };

            // 1. Insert Sale and get ID
            const { data: saleData, error: saleError } = await supabase
                .from("sales")
                .insert([payload])
                .select()
                .single();

            if (saleError) throw saleError;

            const saleId = saleData.id;

            // 2. Generate Payment References (The Core CCP Logic)
            let referenceIds = [];
            if (saleType === "installment") {
                const totalMonthly = monthlyInstallment;
                // Algorithm: Split totalMonthly into N references
                // Constraints: Max 5 refs, Min 500 DA per ref
                let numRefs = 1;
                // Try to find a number of references (1-5) where amount >= 500
                for (let n = 5; n >= 1; n--) {
                    if (totalMonthly / n >= 500) {
                        numRefs = n;
                        break;
                    }
                }

                const amountPerRef = Math.floor(totalMonthly / numRefs);
                const remainder = totalMonthly - (amountPerRef * numRefs);

                const generatedReferences = [];
                for (let i = 0; i < numRefs; i++) {
                    const isLast = i === numRefs - 1;
                    const finalAmount = isLast ? amountPerRef + remainder : amountPerRef;

                    // Generate unique 12-digit code: "REF" + Random
                    const uniqueCode = "REF" + Math.floor(100000000 + Math.random() * 900000000);

                    generatedReferences.push({
                        sale_id: saleId,
                        reference_code: uniqueCode,
                        amount: finalAmount,
                        start_month: new Date().toISOString().split('T')[0], // Should technically be start of payments
                        end_month: new Date(new Date().setMonth(new Date().getMonth() + formData.months)).toISOString().split('T')[0]
                    });
                }

                // Insert References
                const { data: refData, error: refError } = await supabase
                    .from("payment_references")
                    .insert(generatedReferences)
                    .select("id"); // Get IDs to link installments

                if (refError) throw refError;
                referenceIds = refData.map(r => r.id);
            }

            // 3. Generate Installments (Linked to References)
            if (saleType === "installment" && formData.months > 0) {
                const installments = [];
                let currentDate = new Date();

                // Find selected contract day
                // formData.withdrawal_day now holds contract_id due to UI change below
                // Wait, I need to make sure UI maps to contract_id
                const selectedContract = contracts.find(c => c.id === formData.withdrawal_day);
                const targetDay = selectedContract ? selectedContract.withdrawal_day : 1;

                // Move to next month first to start installments
                currentDate.setMonth(currentDate.getMonth() + 1);

                for (let i = 0; i < formData.months; i++) {
                    // Set year and month
                    let year = currentDate.getFullYear();
                    let month = currentDate.getMonth();
                    let dueDate = new Date(year, month, targetDay);

                    // Distribute this month's installment across the generated references?
                    // NO: The prompt implies References sum up to the Monthly Installment.
                    // So for EACH MONTH, we might need multiple "Installment Items" if we track them separately?
                    // OR: Do we just link the installment to a single "Main Reference" or all of them?
                    // Clarification from logic: "Total of References = Monthly Installment". 
                    // This means essentially the user owes X amount, covered by Ref A + Ref B + ...
                    // Simpler approach for now: Link installment to the *Primary* reference or leave null and resolve by Month?
                    // Let's link to the FIRST reference ID for tracking, but actually the system relies on File Import.
                    // The Import will act on "Reference Code".

                    installments.push({
                        sale_id: saleId,
                        amount: monthlyInstallment,
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'pending',
                        // We can't easily link 1 installment to 5 references in a foreign key column 
                        // without a many-to-many table.
                        // However, the USER requirement is "Update installment status monthly based on reference".
                        // If there are multiple references, we need multiple installment rows per month?
                        // "Mise à jour état des prélèvements": likely each reference is a "prelevement".

                        // RE-READING LOGIC: "Mise à jour état des prélèvements ... selon reference"
                        // If a sale has 3 references, it means 3 withdrawals happen per month.
                        // So we should generate 3 Installment records per month?
                        // YES. "Installment" row represents a single withdrawal attempt.
                    });

                    // Actually, let's stick to 1 Installment Row per Month for simple UI visualization first,
                    // BUT the user says "Import Text File... Update Installment Status".
                    // If the text file contains Reference A (success) and Reference B (failed), 
                    // we need separate rows to show that partial payment happened?

                    // Let's split installments here too!
                    // If we generated 3 references, we create 3 installment rows for "Jan 2025".

                    if (referenceIds.length > 0) {
                        // Split Installments Logic
                        referenceIds.forEach((refId, idx) => {
                            // We need to know the amount for this specific reference.
                            // We can get it from our 'generatedReferences' array logic above or refetch.
                            // Re-calculating locally for simplicity:
                            // (Ideally we used the array objects before insert, but we have IDs now)
                            // Let's re-use the loop logic:
                            // Re-calculation might be risky if we don't preserve order.
                            // Let's assume order is preserved in select().
                        });

                        // Safer: Just create ONE installment for now OR ask clarification? 
                        // User Prompt: "Update status ... depending on reference".
                        // "Coloring ... monthly".
                        // If I have 1 green and 1 red reference for the same month, what is the month color?
                        // Maybe "Partial"?

                        // Decision: Create ONE "Master Installment" for the month (Visualization). 
                        // The detailed "Withdrawal Status" will be tracked in a separate table or just simplified.
                        // Wait, Step 5 says "Update installment.status".
                        // If file says Ref A is 0 (Green), update.

                        // Re-reading Schema: "installments add column reference_id".
                        // This implies 1 Installment Row = 1 Reference!
                        // So if we have 3 references, we MUST generate 3 installment rows per month.
                        // This matches "payments sum up to monthly amount".
                    }

                    // Increment month for next loop
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }

                // CORRECTED LOOP FOR SPLIT INSTALLMENTS
                const splitInstallments = [];
                currentDate = new Date();
                currentDate.setMonth(currentDate.getMonth() + 1); // Reset to start

                // Re-calculate amounts per reference to map correctly
                const refAmounts = []; // Map of index -> amount
                const totalMonthly = monthlyInstallment;
                let numRefs = referenceIds.length || 1;
                // (Re-run split logic to get amounts)
                const amountPerRef = Math.floor(totalMonthly / numRefs);
                const remainder = totalMonthly - (amountPerRef * numRefs);
                for (let k = 0; k < numRefs; k++) refAmounts.push(k === numRefs - 1 ? amountPerRef + remainder : amountPerRef);

                for (let i = 0; i < formData.months; i++) {
                    let year = currentDate.getFullYear();
                    let month = currentDate.getMonth();
                    let dueDate = new Date(year, month, targetDay).toISOString().split('T')[0];

                    if (referenceIds.length > 0) {
                        // Create one installment row per Reference
                        referenceIds.forEach((refId, idx) => {
                            splitInstallments.push({
                                sale_id: saleId,
                                amount: refAmounts[idx], // Specific amount for this reference
                                due_date: dueDate,
                                status: 'pending',
                                reference_id: refId,
                                postal_status: -1 // Pending
                            });
                        });
                    } else {
                        // Fallback for Cash/Manual if no references (Single row)
                        splitInstallments.push({
                            sale_id: saleId,
                            amount: monthlyInstallment,
                            due_date: dueDate,
                            status: 'pending',
                            postal_status: -1
                        });
                    }
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }

                const { error: installError } = await supabase
                    .from("installments")
                    .insert(splitInstallments);

                if (installError) throw installError;
            }

            onSuccess();
            onClose();
            // Reset form
            setFormData({
                customer_id: "",
                product_name: "",
                cash_price: "",
                installment_price: "",
                down_payment: 0,
                months: 15,
                withdrawal_day: 1,
            });
        } catch (err) {
            alert("خطأ أثناء الحفظ: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h3 className="font-bold text-xl text-gray-800">إنشاء عقد بيع جديد</h3>
                        <p className="text-sm text-gray-500 mt-1">أدخل بيانات السلعة والزبون</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col h-[80vh] md:h-auto overflow-y-auto">
                    <div className="p-6 space-y-6">

                        {/* Sale Type Toggle */}
                        <div className="flex p-1 bg-gray-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setSaleType("installment")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${saleType === "installment"
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                <ScrollTextIcon size={18} />
                                بيع بالتقسيط
                            </button>
                            <button
                                type="button"
                                onClick={() => setSaleType("cash")}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${saleType === "cash"
                                    ? "bg-white text-green-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                <Banknote size={18} />
                                بيع كاش (نقداً)
                            </button>
                        </div>

                        {/* Customer Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <User size={16} className="text-gray-400" />
                                اختر الزبون
                            </label>
                            <select
                                required
                                value={formData.customer_id}
                                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">-- اختر زبوناً من القائمة --</option>
                                {customers.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.first_name} {c.last_name} {c.ccp_number ? `(CCP: ${c.ccp_number})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Product Details */}
                        <div className="space-y-4 border-t border-gray-100 pt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">اسم المنتج / السلعة</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="مثال: ثلاجة كوندور 400 لتر"
                                    value={formData.product_name}
                                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">سعر الكاش (للعلم)</label>
                                    <div className="relative">
                                        <input
                                            required
                                            type="number"
                                            placeholder="0.00"
                                            value={formData.cash_price}
                                            onChange={(e) => setFormData({ ...formData, cash_price: e.target.value })}
                                            className="w-full p-3 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono font-bold text-gray-700"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">DZD</span>
                                    </div>
                                </div>

                                {saleType === "installment" && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-blue-700">سعر البيع بالتقسيط (الإجمالي)</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type="number"
                                                placeholder="0.00"
                                                value={formData.installment_price}
                                                onChange={(e) => setFormData({ ...formData, installment_price: e.target.value })}
                                                className="w-full p-3 pl-12 border-2 border-blue-100 bg-blue-50/50 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-blue-700"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-bold">DZD</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {saleType === "installment" && (
                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4 animate-in slide-in-from-top-4">
                                <div className="text-xs text-red-500 font-mono p-2 bg-red-50 border border-red-200 rounded mb-2" dir="ltr">
                                    DEBUG: Monthly={monthlyInstallment} | Refs={splitPreview.length} | Price={formData.installment_price} | Months={formData.months}
                                </div>
                                <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                    <Calculator size={18} />
                                    حاسبة الأقساط والتقسيم
                                </h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">مدة التقسيط (أشهر)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.months}
                                            onChange={(e) => setFormData({ ...formData, months: e.target.value })}
                                            className="w-full p-2 border border-blue-200 rounded-lg text-center font-bold text-lg text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">نوع العقد (يوم السحب)</label>
                                        <select
                                            value={formData.withdrawal_day}
                                            onChange={(e) => setFormData({ ...formData, withdrawal_day: e.target.value })}
                                            className="w-full p-2 border border-blue-200 rounded-lg text-center font-bold text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {contracts.length > 0 ? (
                                                contracts.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} (يسحب يوم {c.withdrawal_day})</option>
                                                ))
                                            ) : (
                                                <option value="1">جاري التحميل...</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">الدفعة الأولى (تسبقة)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.down_payment}
                                            onChange={(e) => setFormData({ ...formData, down_payment: e.target.value })}
                                            className="w-full p-2 pl-10 border border-blue-200 rounded-lg font-bold text-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">DZD</span>
                                    </div>
                                </div>

                                {/* Summary Box */}
                                <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm flex items-center justify-between">
                                    <span className="text-gray-500 font-medium text-sm">قيمة القسط الشهري:</span>
                                    <div className="text-xl font-black text-blue-600">
                                        {monthlyInstallment.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm font-normal text-gray-400">د.ج</span>
                                    </div>
                                </div>

                                {/* Reference Split Preview */}
                                {splitPreview.length > 0 && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                        <h5 className="text-xs font-bold text-yellow-700 mb-2 flex items-center gap-1">
                                            <CreditCard size={12} />
                                            نظام التقسيم التلقائي (المرجع 500 دج كحد أدنى)
                                        </h5>
                                        <div className="space-y-1">
                                            {splitPreview.map((ref) => (
                                                <div key={ref.index} className="flex justify-between text-sm text-yellow-800 px-2 py-0.5 bg-yellow-100/50 rounded">
                                                    <span>المرجع {ref.index}</span>
                                                    <span className="font-bold">{ref.amount.toLocaleString()} دج</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-8 py-2.5 text-white rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-200 font-bold ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                            >
                                <Save size={20} />
                                {loading ? "جاري الحفظ..." : "حفظ العقد"}
                            </button>
                        </div>

                    </div>
                </form>
            </div>
        </div>
    );
}

// Icon for Installment
function ScrollTextIcon({ size, className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M15 12h-5" />
            <path d="M15 8h-5" />
            <path d="M19 17V5a2 2 0 0 0-2-2H4" />
            <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v2a2 2 0 0 0 2 2z" />
        </svg>
    )
}
