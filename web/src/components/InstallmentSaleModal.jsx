import { useState, useEffect } from "react";
import { X, Save, Calculator, Search, User, Package, Check, CreditCard, Building2 } from "lucide-react";
import { supabase } from "../supabase";

import { useProfile } from "../hooks/useProfile";

export default function InstallmentSaleModal({ isOpen, onClose, onSuccess }) {
    const { profile, loading: profileLoading } = useProfile();
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Search States
    const [custSearch, setCustSearch] = useState("");
    const [prodSearch, setProdSearch] = useState("");
    const [cart, setCart] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        // installment_price: NO LONGER USER INPUT, it's calculated from Cart
        down_payment: 0,
        months: 15,
        start_month: new Date().toISOString().slice(0, 7), // YYYY-MM
        start_day: 1, // Will be mapped from Contract
    });

    const [contracts, setContracts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [isBranchLocked, setIsBranchLocked] = useState(false);

    const [splitPreview, setSplitPreview] = useState([]);
    const [manualRefCount, setManualRefCount] = useState(1);

    // Reference Editing & Validation
    const [customReferences, setCustomReferences] = useState({});
    const [refValidation, setRefValidation] = useState({});

    // [NEW] ATOMIC GENERATOR
    useEffect(() => {
        const generateAtomicReferences = async () => {
            if (!selectedBranch || !selectedBranch.reference_prefix || splitPreview.length === 0) return;

            const prefix = selectedBranch.reference_prefix;
            const newCustoms = {};

            const { data: lastRefs } = await supabase
                .from('payment_references')
                .select('reference_code')
                .ilike('reference_code', `${prefix}%`)
                .order('id', { ascending: false })
                .limit(1);

            let lastNum = 0;
            if (lastRefs && lastRefs.length > 0) {
                const match = lastRefs[0].reference_code.match(/(\d+)$/);
                if (match) lastNum = parseInt(match[0]);
            }

            for (let i = 0; i < splitPreview.length; i++) {
                const nextNum = lastNum + i + 1;
                newCustoms[i] = `${prefix}${nextNum}`;
            }

            setCustomReferences(prev => {
                return { ...newCustoms };
            });
        };

        generateAtomicReferences();
    }, [selectedBranch, splitPreview.length]);

    // Async Ref Check
    const checkReferenceUniqueness = async (code, index) => {
        if (!code) {
            setRefValidation(prev => ({ ...prev, [index]: { status: 'idle', msg: '' } }));
            return;
        }

        const isDuplicateInternal = Object.entries(customReferences).some(([k, v]) => v === code && parseInt(k) !== index);
        if (isDuplicateInternal) {
            setRefValidation(prev => ({ ...prev, [index]: { status: 'invalid', msg: 'مكرر في القائمة!' } }));
            return;
        }

        setRefValidation(prev => ({ ...prev, [index]: { status: 'loading', msg: 'جاري التحقق...' } }));

        try {
            const { count, error } = await supabase
                .from('payment_references')
                .select('id', { count: 'exact', head: true })
                .eq('reference_code', code);

            if (error) throw error;

            if (count > 0) {
                setRefValidation(prev => ({ ...prev, [index]: { status: 'invalid', msg: 'مستخدم سابقاً!' } }));
            } else {
                setRefValidation(prev => ({ ...prev, [index]: { status: 'valid', msg: 'متاح ✅' } }));
            }
        } catch (err) {
            console.error(err);
            setRefValidation(prev => ({ ...prev, [index]: { status: 'invalid', msg: 'خطأ في التحقق' } }));
        }
    };

    const handleRefChange = (index, value) => {
        setCustomReferences(prev => ({ ...prev, [index]: value }));
    };

    useEffect(() => {
        // ... (Cleanup or logic if needed)
    }, [customReferences]);

    const [debounceTimers, setDebounceTimers] = useState({});

    const onRefInputChange = (index, value) => {
        setCustomReferences(prev => ({ ...prev, [index]: value }));
        setRefValidation(prev => ({ ...prev, [index]: { status: 'loading', msg: '...' } }));

        if (debounceTimers[index]) clearTimeout(debounceTimers[index]);

        const newTimer = setTimeout(() => {
            checkReferenceUniqueness(value, index);
        }, 500);

        setDebounceTimers(prev => ({ ...prev, [index]: newTimer }));
    };

    // Async Search Logic
    useEffect(() => {
        const loadData = async () => {
            // 1. Load Contracts
            const { data: contractData } = await supabase.from("contracts").select("*").order("type");
            setContracts(contractData || []);

            if (contractData && contractData.length > 0) {
                const defaultC = contractData.find(c => c.type === 1) || contractData[0];
                setFormData(prev => ({ ...prev, start_day: defaultC.id }));
            }

            // 2. Load Branches
            const { data: branchData } = await supabase.from("branches").select("*").order("id");
            setBranches(branchData || []);
        };
        if (isOpen) loadData();
    }, [isOpen]);

    // Handle Profile & Branch Locking
    useEffect(() => {
        if (!branches.length) return;

        if (profile?.branch_id) {
            // User Restricted
            const restrictedBranch = branches.find(b => b.id === profile.branch_id);
            if (restrictedBranch) {
                setSelectedBranch(restrictedBranch);
                setIsBranchLocked(true);
            }
        } else {
            // Admin / Unrestricted
            setIsBranchLocked(false);
            if (!selectedBranch && branches.length > 0) {
                setSelectedBranch(branches[0]);
            }
        }
    }, [profile, branches]);

    // Debounced Search for Customers with AbortController
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const timer = setTimeout(async () => {
            if (!custSearch) {
                setCustomers([]);
                return;
            }
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("customers")
                    .select("id, first_name, last_name, ccp_number, phone")
                    .or(`first_name.ilike.%${custSearch}%,last_name.ilike.%${custSearch}%,ccp_number.ilike.%${custSearch}%`)
                    .limit(20)
                    .abortSignal(signal);

                if (!error) {
                    setCustomers(data || []);
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.error(err);
            } finally {
                setLoading(false);
            }
        }, 500); // Increased to 500ms

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [custSearch]);

    // Inventory
    const [branchStock, setBranchStock] = useState({});

    // Debounced Search for Products with AbortController
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const timer = setTimeout(async () => {
            if (!prodSearch) {
                setProducts([]);
                return;
            }
            // setLoading(true); 
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("id, name, reference, installment_price")
                    .or(`name.ilike.%${prodSearch}%,reference.ilike.%${prodSearch}%`)
                    .limit(20)
                    .abortSignal(signal);

                if (!error) {
                    setProducts(data || []);
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.error(err);
            }
        }, 500); // Increased to 500ms

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [prodSearch]);

    // Fetch Branch Stock
    useEffect(() => {
        if (selectedBranch) {
            fetchBranchStock(selectedBranch.id);
        } else {
            setBranchStock({});
        }
    }, [selectedBranch]);

    async function fetchBranchStock(branchId) {
        const { data } = await supabase
            .from("branch_stock")
            .select("product_id, quantity")
            .eq("branch_id", branchId);

        if (data) {
            const stockMap = {};
            data.forEach(item => {
                stockMap[item.product_id] = item.quantity;
            });
            setBranchStock(stockMap);
        }
    }


    // Cart Logic
    const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 1)), 0);

    const monthlyInstallment = (cartTotal && formData.months)
        ? (cartTotal - formData.down_payment) / formData.months
        : 0;

    useEffect(() => {
        if (monthlyInstallment > 0) {
            const totalMonthly = monthlyInstallment;
            const numRefs = manualRefCount; // Used manual count

            const amountPerRef = Math.floor(totalMonthly / numRefs);
            // Fix remainder: If amountPerRef is 0 because total < numRefs, we must handle it.
            // If amountPerRef < 1, we force amountPerRef to be at least 0? No constraint is > 0.

            const remainder = totalMonthly - (amountPerRef * numRefs);

            const previews = [];
            for (let i = 0; i < numRefs; i++) {
                let amt = i === numRefs - 1 ? amountPerRef + remainder : amountPerRef;
                if (amt > 0) {
                    previews.push({
                        index: i + 1,
                        amount: amt
                    });
                }
            }
            setSplitPreview(previews);
        } else {
            setSplitPreview([]);
        }
    }, [monthlyInstallment, manualRefCount]);

    function addToCart() {
        if (!selectedProduct && !prodSearch) return;

        const productToAdd = selectedProduct || {
            id: null,
            name: prodSearch,
            installment_price: 0,
            reference: '-'
        };

        // Stock Check
        if (productToAdd.id && selectedBranch) {
            const currentStock = branchStock[productToAdd.id] || 0;
            // Check if already in cart
            const inCart = cart.find(i => i.id === productToAdd.id);
            const currentQty = inCart ? (parseInt(inCart.quantity) + 1) : 1;

            if (currentQty > currentStock) {
                alert(`عذراً، الكمية المتوفرة في هذا الفرع: ${currentStock}`);
                return;
            }
        }

        const existingItem = cart.find(item => item.name === productToAdd.name);
        if (existingItem) {
            alert("هذا المنتج مضاف بالفعل!");
            return;
        }

        // Fix: Ensure price is a number to prevent rendering crash inside toLocaleString()
        const initialPrice = parseFloat(productToAdd.installment_price) || 0;

        setCart([...cart, { ...productToAdd, price: initialPrice, quantity: 1 }]);
        setSelectedProduct(null);
        setProdSearch("");
    }

    function removeFromCart(index) {
        setCart(cart.filter((_, i) => i !== index));
    }

    function updateCartItem(index, field, value) {
        const newCart = [...cart];
        const item = newCart[index];

        if (field === 'quantity') {
            const qty = parseInt(value) || 0;
            if (item.id && selectedBranch) {
                const currentStock = branchStock[item.id] || 0;
                if (qty > currentStock) {
                    alert(`عذراً، الكمية المتوفرة في هذا الفرع: ${currentStock}`);
                    return;
                }
            }
        }

        item[field] = value;
        setCart(newCart);
    }

    // Direct usage of results (no client-side filtering needed)
    const filteredCustomers = customers;
    const filteredProducts = products;

    async function handleSubmit(e) {
        e.preventDefault();
        if (!selectedCustomer) return alert("الرجاء اختيار زبون");

        // VALIDATION: Check for Invalid Month
        const [vYear, vMonth] = formData.start_month.split('-').map(Number);

        if (vMonth < 1 || vMonth > 12) {
            return alert("⚠️ الشهر غير صالح! الرجاء اختيار شهر صحيح (1-12).");
        }

        const vDay = parseInt(formData.start_day); // This is CONTRACT ID now. 
        // Logic below needs to resolve Contract ID to Day AGAIN because we removed it from state variables logic above? 
        // Wait, formData.start_day IS the contract ID.

        // We need to fetch the day or find it in contracts array
        const selectedC = contracts.find(c => c.id === formData.start_day);
        if (!selectedC) return alert("خطأ في تحديد نوع العقد");

        // Force strict days based on contract type
        // This overrides DB values if they are wrong (e.g. 31)
        let targetDay = selectedC.withdrawal_day;
        if (selectedC.type === 30) targetDay = 30; // Strict 30
        if (selectedC.type === 1) targetDay = 1;   // Strict 1

        // Accurate date calculation (clamping to end of month if needed)
        let vCheckDate = new Date(vYear, vMonth - 1, 1);
        let vMaxDay = new Date(vCheckDate.getFullYear(), vCheckDate.getMonth() + 1, 0).getDate();
        let vActualDay = Math.min(targetDay, vMaxDay);

        const firstInstallmentDate = new Date(vYear, vMonth - 1, vActualDay);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (firstInstallmentDate < today) {
            return alert("⚠️ لا يمكن أن يكون تاريخ بداية الأقساط في الماضي!\n\nالتاريخ المحسوب: " + firstInstallmentDate.toLocaleDateString("ar-DZ"));
        }

        setLoading(true);

        try {
            const productNames = cart.map(i => `${i.name} (${i.quantity})`).join(" + ");

            const payload = {
                customer_id: selectedCustomer.id,
                sale_type: "installment",
                product_names: productNames,
                total_amount: cartTotal,
                paid_amount: formData.down_payment,
                status: "active",
                withdrawal_day: vActualDay, // Use the validated actual day
                installment_months: formData.months,
                monthly_installment_amount: monthlyInstallment,
                branch_id: selectedBranch?.id // [NEW] Link Sale to Branch
            };

            const { data: saleData, error: saleError } = await supabase.from("sales").insert([payload]).select().single();
            if (saleError) throw saleError;

            // Insert Sale Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: parseInt(item.quantity),
                unit_price: parseFloat(item.price)
            }));

            const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
            if (itemsError) throw itemsError;

            // Generate Installments
            const installments = [];
            // Parse Year/Month from input
            const [startYear, startMonth] = formData.start_month.split('-').map(Number);
            // --- GENERATE REFERENCES (Manual Split) ---
            let referenceIds = [];
            const timestamp = Date.now().toString(36).toUpperCase();

            // Create references first
            // Create references first
            // Create references first
            for (let k = 0; k < splitPreview.length; k++) {
                if (splitPreview[k].amount < 500) {
                    return alert(`⚠️ لا يمكن حفظ العقد!\n\nقيمة المرجع رقم ${k + 1} هي ${splitPreview[k].amount} دج.\nالحد الأدنى المسموح به لكل مرجع هو 500 دج.`);
                }

                // Check for validation errors on custom references
                const customRef = customReferences[k];
                if (customRef) {
                    const status = refValidation[k]?.status;
                    if (status === 'invalid' || status === 'loading') {
                        return alert(`⚠️ لا يمكن حفظ العقد!\n\nالمرجع رقم ${k + 1} غير صالح أو مكرر: ${customRef}`);
                    }
                }

                // Use custom reference OR generate default
                const refCode = customRef || `REF-${saleData.id}-${k + 1}-${timestamp}`;

                const refPayload = {
                    sale_id: saleData.id,
                    reference_code: refCode,
                    amount: splitPreview[k].amount,
                    start_month: new Date(startYear, startMonth - 1, 1),
                    end_month: new Date(startYear, startMonth - 1 + parseInt(formData.months), 0)
                };
                const { data: refData, error: refError } = await supabase.from("payment_references").insert([refPayload]).select().single();
                if (refError) throw refError;
                referenceIds.push({ id: refData.id, amount: refData.amount });
            }



            for (let i = 0; i < formData.months; i++) {
                // Fix: Define currentMonthIndex
                let currentMonthIndex = (startMonth - 1) + i;

                // Calculate Clamped Date
                let checkDate = new Date(startYear, currentMonthIndex, 1);
                let maxDaysInMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0).getDate();

                // We need to access 'targetDay' which was defined earlier in the function scope (line 185)
                // But the code I am replacing (lines 230-255) redefined it wrongly at line 231.
                // I will NOT redefine it here, assuming `targetDay` from outer scope is correct.
                // Wait, I need to make sure `targetDay` is available.
                // Looking at file content: `targetDay` IS defined at line 185.
                // But line 231 redefined it. Accessing it here might be tricky if I don't remove line 231.
                // The replacement REPLACES line 231, so the outer `targetDay` (line 185) will be visible! Perfect.

                let actualDay = Math.min(targetDay, maxDaysInMonth);

                let finalDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), actualDay);
                // Fix: Manual formatting to avoid UTC timezone shift (which was causing "Day 1" to become "Day 31 of prev month")
                const year = finalDate.getFullYear();
                const month = String(finalDate.getMonth() + 1).padStart(2, '0');
                const day = String(finalDate.getDate()).padStart(2, '0');
                const dateString = `${year}-${month}-${day}`;

                // Create installment record(s) for this month - linked to reference(s)
                if (referenceIds.length > 0) {
                    referenceIds.forEach(ref => {
                        installments.push({
                            sale_id: saleData.id,
                            amount: ref.amount,
                            due_date: dateString,
                            status: 'pending',
                            reference_id: ref.id
                        });
                    });
                } else {
                    installments.push({
                        sale_id: saleData.id,
                        amount: monthlyInstallment,
                        due_date: dateString,
                        status: 'pending'
                    });
                }
            }

            const { error: installError } = await supabase.from("installments").insert(installments);
            if (installError) throw installError;

            onSuccess();
            onClose();
            resetForm();
        } catch (err) {
            alert("خطأ: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setCustSearch("");
        setProdSearch("");
        setSelectedCustomer(null);
        setSelectedProduct(null);
        setCustomReferences({});
        setRefValidation({});
        setFormData({
            installment_price: "",
            down_payment: 0,
            months: 15,
            start_month: new Date().toISOString().slice(0, 7),
            start_day: 30
        });
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-blue-50">
                    <div>
                        <h3 className="font-bold text-xl text-blue-800 flex items-center gap-2">
                            <Package className="text-blue-600" />
                            عقد بيع بالتقسيط
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-full text-blue-500">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* [NEW] Global Settings Row (Branch) */}
                    <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900">فرع البيع (المصدر)</h4>
                                <p className="text-xs text-indigo-500">يتم توليد أرقام العقود بناءً على هذا الفرع</p>
                            </div>
                        </div>
                        <select
                            value={selectedBranch?.id || ""}
                            disabled={isBranchLocked}
                            onChange={e => {
                                const b = branches.find(br => br.id === parseInt(e.target.value));
                                setSelectedBranch(b);
                            }}
                            className={`p-2 px-4 border rounded-lg font-bold text-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500 ${isBranchLocked ? 'bg-gray-100 cursor-not-allowed border-gray-300' : 'bg-white border-indigo-200'}`}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name} ({b.reference_prefix || "?"})</option>
                            ))}
                        </select>
                        {isBranchLocked && <div className="text-xs text-red-500 font-bold mr-2">🔒 مقيد بهذا الفرع</div>}
                    </div>

                    {/* Right Column: Search & Select */}
                    <div className="space-y-6">

                        {/* Customer Search */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">1. اختيار الزبون (الاسم أو CCP)</label>
                            {!selectedCustomer ? (
                                <div className="relative">
                                    <Search className="absolute right-3 top-3 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="ابحث..."
                                        value={custSearch}
                                        onChange={e => setCustSearch(e.target.value)}
                                        className="w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    {custSearch && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 shadow-lg rounded-xl mt-1 max-h-40 overflow-y-auto z-10">
                                            {filteredCustomers.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={() => setSelectedCustomer(c)}
                                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                >
                                                    <div className="font-bold text-gray-800">{c.first_name} {c.last_name}</div>
                                                    <div className="text-xs text-gray-500 font-mono">CCP: {c.ccp_number} | Phone: {c.phone}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-blue-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                                        <div className="text-sm text-blue-600">CCP: {selectedCustomer.ccp_number}</div>
                                    </div>
                                    <button onClick={() => setSelectedCustomer(null)} className="text-red-500 bg-white p-1 rounded-full shadow-sm hover:shadow">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Product Search & Cart */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">2. إضافة منتجات (الاسم أو المرجع)</label>

                            <div className="flex gap-2 mb-2">
                                <div className="relative flex-1">
                                    {!selectedProduct ? (
                                        <>
                                            <Search className="absolute right-3 top-3 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="ابحث عن منتج..."
                                                value={prodSearch}
                                                onChange={e => setProdSearch(e.target.value)}
                                                className="w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            {prodSearch && filteredProducts.length > 0 && (
                                                <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 shadow-lg rounded-xl mt-1 max-h-60 overflow-y-auto z-10 divide-y divide-gray-50">
                                                    {filteredProducts.map(p => {
                                                        const stockQty = branchStock[p.id] || 0;
                                                        const isOutOfStock = stockQty <= 0;

                                                        return (
                                                            <div
                                                                key={p.id}
                                                                onClick={() => {
                                                                    if (isOutOfStock) return alert("نفذت الكمية في هذا الفرع!");
                                                                    setSelectedProduct(p);
                                                                }}
                                                                className={`p-3 cursor-pointer transition-colors flex justify-between items-center ${isOutOfStock
                                                                        ? 'bg-red-50 hover:bg-red-100 opacity-80'
                                                                        : 'hover:bg-blue-50'
                                                                    }`}
                                                            >
                                                                <div>
                                                                    <div className={`font-bold ${isOutOfStock ? 'text-gray-500' : 'text-gray-800'}`}>
                                                                        {p.name}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 font-mono">
                                                                        Ref: {p.reference || '-'}
                                                                    </div>
                                                                </div>

                                                                <div className="text-left">
                                                                    <div className={`text-sm font-bold ${isOutOfStock ? 'text-red-600' : 'text-blue-600'}`}>
                                                                        {p.installment_price?.toLocaleString()} د.ج
                                                                    </div>
                                                                    <div className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ml-auto mt-1 ${isOutOfStock
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-green-100 text-green-700'
                                                                        }`}>
                                                                        المخزون: {stockQty}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-gray-900">{selectedProduct.name}</div>
                                                <div className="text-sm text-gray-500">Ref: {selectedProduct.reference}</div>
                                            </div>
                                            <button onClick={() => { setSelectedProduct(null); setProdSearch(""); }} className="text-red-500 bg-white p-1 rounded-full shadow-sm hover:shadow">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={addToCart}
                                    className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700"
                                >
                                    إضافة
                                </button>
                            </div>

                            {cart.length > 0 && (
                                <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-blue-50 text-blue-900 font-bold">
                                            <tr>
                                                <td className="p-2">المنتج</td>
                                                <td className="p-2 w-16">الكمية</td>
                                                <td className="p-2 w-20">السعر</td>
                                                <td className="p-2 w-20">لإجمالي</td>
                                                <td className="p-2 w-8"></td>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cart.map((item, idx) => (
                                                <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                    <td className="p-2 font-medium truncate max-w-[100px]">{item.name}</td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number" min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => updateCartItem(idx, 'quantity', e.target.value)}
                                                            className="w-full p-1 border rounded text-center"
                                                        />
                                                    </td>
                                                    <td className="p-2 font-mono">
                                                        <input
                                                            type="number" min="0"
                                                            value={item.price}
                                                            onChange={(e) => updateCartItem(idx, 'price', e.target.value)}
                                                            className="w-full p-1 border rounded text-center"
                                                        />
                                                    </td>
                                                    <td className="p-2 font-bold text-blue-700">
                                                        {(item.price * item.quantity).toLocaleString()}
                                                    </td>
                                                    <td className="p-2">
                                                        <button onClick={() => removeFromCart(idx)} className="text-red-500 hover:text-red-700">
                                                            <X size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-blue-100 font-bold text-blue-900">
                                            <tr>
                                                <td colSpan="3" className="p-2 pl-4">المجموع</td>
                                                <td colSpan="2" className="p-2">{cartTotal.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Left Column: Calculation */}
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-5">
                        <h4 className="font-bold text-blue-800 flex items-center gap-2 border-b border-blue-200 pb-2">
                            <Calculator size={20} />
                            تفاصيل العقد المالي
                        </h4>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">سعر التقسيط (محسوب من السلة)</label>
                            <div className="relative">
                                <div className="w-full p-3 pl-12 border-2 border-blue-200 bg-gray-100 rounded-xl text-lg font-bold text-gray-600 flex items-center">
                                    {cartTotal.toLocaleString()}
                                </div>
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">DZD</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-24 shrink-0">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">المدة (أشهر)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.months}
                                    onChange={(e) => setFormData({ ...formData, months: e.target.value })}
                                    className="w-full p-2 border border-blue-200 rounded-lg text-center font-bold text-blue-800"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">بداية الأقساط (شهر/عام)</label>
                                <div className="flex gap-2 text-sm">
                                    <div className="flex-1 flex gap-1">
                                        {/* Year Select */}
                                        <select
                                            value={formData.start_month.split('-')[0]}
                                            onChange={(e) => {
                                                const newYear = e.target.value;
                                                const month = formData.start_month.split('-')[1];
                                                setFormData({ ...formData, start_month: `${newYear}-${month}` });
                                            }}
                                            className="w-1/2 p-2 border border-blue-200 rounded-lg text-center font-bold text-blue-800 bg-blue-50 outline-none"
                                        >
                                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                        {/* Month Select */}
                                        <select
                                            value={formData.start_month.split('-')[1]}
                                            onChange={(e) => {
                                                const newMonth = e.target.value;
                                                const year = formData.start_month.split('-')[0];
                                                setFormData({ ...formData, start_month: `${year}-${newMonth}` });
                                            }}
                                            className="w-1/2 p-2 border border-blue-200 rounded-lg text-center font-bold text-blue-800 bg-blue-50 outline-none"
                                        >
                                            <option value="01">01 - جانفي</option>
                                            <option value="02">02 - فيفري</option>
                                            <option value="03">03 - مارس</option>
                                            <option value="04">04 - أفريل</option>
                                            <option value="05">05 - ماي</option>
                                            <option value="06">06 - جوان</option>
                                            <option value="07">07 - جويلية</option>
                                            <option value="08">08 - أوت</option>
                                            <option value="09">09 - سبتمبر</option>
                                            <option value="10">10 - أكتوبر</option>
                                            <option value="11">11 - نوفمبر</option>
                                            <option value="12">12 - ديسمبر</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contract Type Row */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">نوع العقد (يوم السحب)</label>
                            <select
                                value={formData.start_day}
                                onChange={(e) => setFormData({ ...formData, start_day: e.target.value })}
                                className="w-full p-2 border border-blue-200 rounded-lg text-center font-bold text-blue-800 bg-blue-50 outline-none"
                            >
                                {contracts.length > 0 ? (
                                    contracts.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} (يوم السحب: {c.withdrawal_day})</option>
                                    ))
                                ) : (
                                    <option value="1">جاري التحميل...</option>
                                )}
                            </select>
                        </div>

                        {/* DEBUG & PREVIEW SECTION */}
                        <div className="space-y-2">
                            {/* Reference Split Preview - YELLOW BOX */}
                            {splitPreview.length > 0 && (
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 animate-in fade-in">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs font-bold text-yellow-700 flex items-center gap-1">
                                            <CreditCard size={12} />
                                            تقسيم المراجع (تعديل الأكواد)
                                        </h5>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setManualRefCount(n)}
                                                    className={`w-6 h-6 rounded text-xs font-bold border transition-all ${manualRefCount === n
                                                        ? 'bg-yellow-500 text-white border-yellow-600 shadow-sm scale-110'
                                                        : 'bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-100'}`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {splitPreview.map((ref, idx) => {
                                            const validation = refValidation[idx];
                                            const isAmountInvalid = ref.amount < 500;

                                            return (
                                                <div key={ref.index} className={`relative p-2 rounded-lg border transition-all ${isAmountInvalid
                                                    ? 'bg-red-50 border-red-300'
                                                    : 'bg-white border-yellow-200 shadow-sm'
                                                    }`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-yellow-800">المرجع #{ref.index}</span>
                                                        <div className="flex items-center gap-2">
                                                            {isAmountInvalid && <span className="text-[10px] font-bold text-red-600 animate-pulse">(أقل من 500 دج!)</span>}
                                                            <span className={`font-mono font-bold ${isAmountInvalid ? 'text-red-700' : 'text-blue-700'}`}>
                                                                {ref.amount.toLocaleString()} دج
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Edit Reference Code Input */}
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="كود تلقائي (اضغط للتعديل)"
                                                            value={customReferences[idx] || ''}
                                                            onChange={(e) => onRefInputChange(idx, e.target.value)}
                                                            className={`w-full text-xs p-1.5 border rounded outline-none font-mono dir-ltr text-left ${validation?.status === 'invalid' ? 'border-red-500 bg-red-50 text-red-700' :
                                                                validation?.status === 'valid' ? 'border-green-500 bg-green-50 text-green-700' :
                                                                    'border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'
                                                                }`}
                                                        />

                                                        {/* Validation Status Icon */}
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                            {validation?.status === 'loading' && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                                                            {validation?.status === 'valid' && <Check size={12} className="text-green-600" />}
                                                            {validation?.status === 'invalid' && <X size={12} className="text-red-600" />}
                                                        </div>
                                                    </div>

                                                    {/* Error Message */}
                                                    {validation?.status === 'invalid' && (
                                                        <div className="text-[10px] text-red-600 mt-1 font-bold text-right">{validation.msg}</div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border border-gray-100">
                            <span className="text-sm font-bold text-gray-500">تاريخ آخر قسط:</span>
                            <span className="font-mono font-bold text-gray-800 dir-ltr">
                                {(() => {
                                    if (!formData.start_month || !formData.months) return "-";
                                    const [y, m] = formData.start_month.split('-').map(Number);

                                    // Fix: Start Day is now a Contract ID, so we must find the day
                                    // If contracts are not loaded yet, fallback to 30
                                    const selectedC = contracts.find(c => c.id === formData.start_day);
                                    let day = selectedC ? selectedC.withdrawal_day : 30;

                                    // Calc Date
                                    // Note: JS Date month is 0-indexed. 
                                    const lastDate = new Date(y, (m - 1) + parseInt(formData.months) - 1, day);
                                    return lastDate.toLocaleDateString("en-GB");
                                })()}
                            </span>
                        </div>


                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">الدفعة الأولى</label>
                            <input
                                type="number"
                                value={formData.down_payment}
                                onChange={(e) => setFormData({ ...formData, down_payment: e.target.value })}
                                className="w-full p-2 border border-gray-200 rounded-lg font-bold text-gray-800"
                            />
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex justify-between items-center">
                            <span className="text-gray-500 font-medium">القسط الشهري:</span>
                            <span className="text-2xl font-black text-blue-600">{monthlyInstallment.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-400 font-normal">د.ج</span></span>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !selectedCustomer || cart.length === 0}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading ? "جاري الحفظ..." : "تأكيد العقد"}
                            <Check size={20} />
                        </button>

                    </div >

                </div >
            </div >
        </div >
    );
}
