import { useEffect, useState } from "react";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, ShieldCheck, Lock } from "lucide-react";
import { supabase } from "../supabase";

export default function Treasury() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(0);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'manager', 'employee'
    const [myBranchId, setMyBranchId] = useState(null);

    // Manual Transaction State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [txType, setTxType] = useState("income"); // income or expense
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        initPage();
    }, []);

    useEffect(() => {
        if (userRole) fetchData();
    }, [selectedBranch, userRole]);

    async function initPage() {
        setLoading(true);
        // 1. Get User Role & Branch
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profile) {
                setUserRole(profile.role);
                setMyBranchId(profile.branch_id);
                // If not admin, lock to own branch
                if (profile.role !== 'admin' && profile.branch_id) {
                    setSelectedBranch(profile.branch_id);
                }
            }
        }
        // 2. Load Branches (For Admin dropdown)
        const { data: branchesData } = await supabase.from("branches").select("*");
        setBranches(branchesData || []);
    }

    async function fetchData() {
        setLoading(true);

        try {
            // A. FETCH TRANSACTIONS (Will return 0 rows for Employee due to RLS)
            let query = supabase
                .from("cash_transactions")
                .select("*, branches(name)")
                .order("created_at", { ascending: false });

            if (selectedBranch) {
                query = query.eq('branch_id', selectedBranch);
            }

            const { data: txData, error: txError } = await query;

            if (txError) {
                console.error("Error fetching transactions:", txError);
            } else {
                setTransactions(txData || []);
            }

            // B. CALCULATE BALANCE (Secure RPC for everyone)
            // If specific branch selected (or enforced), use RPC
            if (selectedBranch) {
                const { data: balData, error: balError } = await supabase.rpc('get_branch_balance', { target_branch_id: selectedBranch });
                if (!balError) setBalance(balData || 0);
            } else if (userRole === 'admin') {
                // Admin global balance: sum from loaded transactions (since Admin sees all)
                // OR calculate cleanly:
                const bal = (txData || []).reduce((acc, curr) => {
                    return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
                }, 0);
                setBalance(bal);
            }

        } catch (e) {
            console.error("Fetch Error:", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleManualTransaction(e) {
        e.preventDefault();
        setSubmitting(true);

        let targetBranch = selectedBranch;
        // Safety check
        if (!targetBranch && userRole !== 'admin') {
            targetBranch = myBranchId;
        }

        if (!targetBranch) {
            alert("يجب اختيار فرع!");
            setSubmitting(false);
            return;
        }

        const { error } = await supabase.from('cash_transactions').insert({
            type: txType, // 'income' or 'expense'
            amount: parseFloat(amount),
            category: 'manual',
            description: description,
            branch_id: targetBranch
        });

        if (error) {
            alert("خطأ: " + error.message);
        } else {
            setIsModalOpen(false);
            setAmount("");
            setDescription("");
            fetchData();
            alert("✅ تمت العملية بنجاح!");
        }
        setSubmitting(false);
    }

    const isEmployee = userRole === 'employee';

    return (
        <div className="space-y-6">
            {/* Header & Balance */}
            <div className="bg-gradient-to-l from-purple-700 to-indigo-800 p-8 rounded-2xl shadow-xl text-white flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
                <div className="relative z-10 w-full md:w-auto">
                    <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
                        <Wallet size={32} />
                        الخزينة {userRole === 'admin' ? "العامة" : "المحلية"}
                    </h2>

                    {/* Role Badge */}
                    <div className="flex gap-2 mt-2">
                        <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold text-indigo-100 flex items-center gap-1">
                            <ShieldCheck size={12} /> {userRole === 'admin' ? 'Admin' : userRole === 'manager' ? 'Manager' : 'Employee'}
                        </span>
                    </div>

                    {/* Branch Selector (Admin Only) */}
                    {userRole === 'admin' && (
                        <div className="flex items-center gap-2 mt-4">
                            <span className="text-indigo-200 text-sm">عرض حسب الفرع:</span>
                            <select
                                className="bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1 text-sm outline-none focus:bg-white/20"
                                value={selectedBranch || ""}
                                onChange={e => setSelectedBranch(e.target.value ? parseInt(e.target.value) : null)}
                            >
                                <option value="" className="text-gray-800">كل الفروع (تجميعي)</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id} className="text-gray-800">{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="relative z-10 text-center md:text-left mt-6 md:mt-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[200px]">
                    <span className="block text-indigo-200 text-sm font-bold uppercase mb-1">الرصيد {selectedBranch ? "الحالي" : "الإجمالي"}</span>
                    <span className="text-4xl font-black tracking-tight">{balance.toLocaleString()} <span className="text-lg text-indigo-300">د.ج</span></span>
                </div>

                {/* Decorative Circles */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-30"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-30"></div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <button
                    onClick={() => { setTxType("income"); setIsModalOpen(true); }}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 p-4 rounded-xl border border-green-200 flex items-center justify-center gap-2 font-bold transition-all shadow-sm hover:shadow-md"
                >
                    <ArrowUpCircle size={24} />
                    تسجيل إيراد (دخل)
                </button>
                <button
                    onClick={() => { setTxType("expense"); setIsModalOpen(true); }}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 p-4 rounded-xl border border-red-200 flex items-center justify-center gap-2 font-bold transition-all shadow-sm hover:shadow-md"
                >
                    <ArrowDownCircle size={24} />
                    تسجيل مصروف (خرج)
                </button>
            </div>

            {/* Transactions Table - HIDDEN for Employee */}
            {isEmployee ? (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center flex flex-col items-center gap-3">
                    <Lock className="text-gray-400 w-12 h-12" />
                    <h3 className="text-lg font-bold text-gray-600">سجل العمليات محمي</h3>
                    <p className="text-gray-500 max-w-md">
                        لديك صلاحية لتسجيل العمليات (إيداع/سحب) ورؤية الرصيد الحالي فقط.
                        <br />
                        لا يمكنك الاطلاع على الأرشيف الكامل للعمليات (Security Policy).
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <h3 className="p-4 font-bold text-gray-700 border-b border-gray-100 flex items-center gap-2">
                        <Calendar size={18} />
                        سجل العمليات المالية
                    </h3>
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-4">نوع العملية</th>
                                {(!selectedBranch && userRole === 'admin') && <th className="p-4">الفرع</th>}
                                <th className="p-4">المبلغ</th>
                                <th className="p-4">التصنيف</th>
                                <th className="p-4">الوصف</th>
                                <th className="p-4">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">جاري تحميل البيانات...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-400">لا توجد عمليات.</td></tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            {tx.type === "income" ? (
                                                <span className="inline-flex items-center gap-1 font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                                                    <ArrowUpCircle size={14} />
                                                    دخل
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                                                    <ArrowDownCircle size={14} />
                                                    خرج
                                                </span>
                                            )}
                                        </td>
                                        {(!selectedBranch && userRole === 'admin') && (
                                            <td className="p-4 text-gray-500 font-bold text-xs">
                                                {tx.branches?.name || "عام"}
                                            </td>
                                        )}
                                        <td className={`p-4 font-black ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                                            {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} د.ج
                                        </td>
                                        <td className="p-4 text-gray-600 font-medium">
                                            {tx.category === 'sales_downpayment' && "عربون مبيعات"}
                                            {tx.category === 'installment_payment' && "تسديد قسط"}
                                            {tx.category === 'manual' && "عملية يدوية"}
                                            {tx.category === 'purchase_payment' && "دفع لمورد"}
                                        </td>
                                        <td className="p-4 text-gray-500">
                                            {tx.description}
                                        </td>
                                        <td className="p-4 text-gray-400 font-mono text-xs">
                                            {new Date(tx.created_at).toLocaleDateString("en-GB")} {new Date(tx.created_at).toLocaleTimeString("en-GB")}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Manual Transaction Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className={`p-4 border-b border-gray-100 flex justify-between items-center ${txType === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <h3 className={`font-bold text-lg flex items-center gap-2 ${txType === 'income' ? 'text-green-800' : 'text-red-800'}`}>
                                {txType === 'income' ? <ArrowUpCircle /> : <ArrowDownCircle />}
                                {txType === 'income' ? "تسجيل دخل (إيراد)" : "تسجيل خرج (مصروف)"}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200">
                                <DollarSign size={20} className="text-gray-500" />
                            </button>
                        </div>
                        <form onSubmit={handleManualTransaction} className="p-6 space-y-4">
                            {/* Branch Selection only for Admin */}
                            {userRole === 'admin' && !selectedBranch && (
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">تحديد الفرع</label>
                                    <select
                                        required
                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none bg-gray-50"
                                        onChange={e => setSelectedBranch(parseInt(e.target.value))}
                                        value={selectedBranch || ""}
                                    >
                                        <option value="" disabled>اختر الفرع...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-700">المبلغ (د.ج)</label>
                                <input
                                    type="number"
                                    required
                                    autoFocus
                                    min="1"
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-xl text-center"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-700">الوصف / السبب</label>
                                <textarea
                                    required
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    rows="3"
                                    placeholder={txType === 'income' ? "مثال: رأس مال إضافي..." : "مثال: مصاريف، شراء لوازم..."}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                ></textarea>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg ${txType === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                                >
                                    {submitting ? "جاري الحفظ..." : "تأكيد"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
