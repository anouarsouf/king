import { useEffect, useState } from "react";
import { TrendingUp, Users, AlertCircle, Package, Calendar, RefreshCcw, Calculator, DollarSign, Percent, Filter, BarChart2, PieChart as PieChartIcon, Activity, HelpCircle, Zap, Bell, AlertOctagon } from "lucide-react";
import { supabase } from "../supabase";
import {
    LineChart, Line, AreaChart, Area,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
    // Quick Stats State
    const [stats, setStats] = useState({
        todaySales: 0,
        todaySalesCount: 0,
        totalCustomers: 0,
        overdueAmount: 0,
        lowStockCount: 0,
        collectionRate: 0,
        totalCollected: 0,
        totalRemaining: 0
    });

    // Analytics State
    const [dateFilter, setDateFilter] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Start of current month
        endDate: new Date().toISOString().split('T')[0] // Today
    });

    const [analytics, setAnalytics] = useState({
        installment: { revenue: 0, cost: 0, profit: 0, count: 0 },
        cash: { revenue: 0, cost: 0, profit: 0, count: 0 },
        total: { revenue: 0, cost: 0, profit: 0 }
    });

    // Chart Data State
    const [chartData, setChartData] = useState({
        salesTrend: [],
        paymentForecast: [],
        topProducts: [],
        customerHealth: [],
        profitableProducts: []
    });

    const [riskMetrics, setRiskMetrics] = useState({ score: 0, level: 'Low', label: 'آمن' });
    const [smartAlerts, setSmartAlerts] = useState([]);
    const [recommendation, setRecommendation] = useState({ text: "", type: "info" });

    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    // --- UI Helpers (Phase 3) ---
    const getStatusColor = (value, type) => {
        if (type === 'rate') {
            if (value >= 90) return 'text-emerald-600';
            if (value >= 70) return 'text-yellow-600';
            return 'text-red-600';
        }
        if (type === 'risk') {
            if (value < 30) return 'text-emerald-600'; // Low risk
            if (value < 70) return 'text-yellow-600'; // Medium
            return 'text-red-600'; // High
        }
        return 'text-gray-800';
    };

    // 1. Fetch Quick Stats, KPI, and Chart Data
    async function fetchStats() {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        try {
            // --- Quick Stats (Existing) ---
            const { data: salesData } = await supabase
                .from("sales")
                .select("total_amount")
                .gte("created_at", today + "T00:00:00")
                .neq("status", "cancelled");

            const todaySales = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

            // Customers
            const { count: customersCount } = await supabase
                .from("customers")
                .select("*", { count: 'exact', head: true });

            // Low Stock
            const { count: lowStockCount } = await supabase
                .from("products")
                .select("*", { count: 'exact', head: true })
                .lt("stock_quantity", 5);

            // --- 3. Collection & Overdue (Global KPI) ---
            const { data: allInstallments } = await supabase
                .from("installments")
                .select("amount, amount_paid, due_date, sale_id, sales(customer_id, customers(first_name, last_name))");

            let totalExpected = 0;
            let totalCollected = 0;
            let overdueAmt = 0;
            const lateCustomerIds = new Set();
            const upcomingAlerts = [];

            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);

            allInstallments?.forEach(inst => {
                totalExpected += inst.amount;
                totalCollected += inst.amount_paid;

                const dueDate = new Date(inst.due_date);
                const isOverdue = inst.due_date < today && inst.amount_paid < inst.amount;
                const isUpcoming = inst.due_date >= today && dueDate <= nextWeek && inst.amount_paid < inst.amount;

                if (isOverdue) {
                    overdueAmt += (inst.amount - inst.amount_paid);
                    if (inst.sales?.customer_id) lateCustomerIds.add(inst.sales.customer_id);
                }

                if (isUpcoming) {
                    upcomingAlerts.push({
                        customer: `${inst.sales?.customers?.first_name} ${inst.sales?.customers?.last_name}`,
                        amount: inst.amount - inst.amount_paid,
                        date: inst.due_date
                    });
                }
            });

            const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
            const totalRemaining = totalExpected - totalCollected;

            // --- AI Risk Calculation ---
            // 1. Collection Score (inverted risk): Higher collection = Lower risk
            const collectionRisk = Math.max(0, 100 - collectionRate);
            // 2. Late Payer Drop: % of customers who are late
            const latePercentage = customersCount > 0 ? (lateCustomerIds.size / customersCount) * 100 : 0;

            // Weighted Risk Score (0-100, 100 is Max Danger)
            const calculatedRisk = (collectionRisk * 0.6) + (latePercentage * 0.4);

            let riskLabel = 'آمن';
            let riskLevel = 'Low';
            if (calculatedRisk > 60) { riskLabel = 'خطر مرتفع'; riskLevel = 'High'; }
            else if (calculatedRisk > 30) { riskLabel = 'متوسط'; riskLevel = 'Medium'; }

            setRiskMetrics({ score: calculatedRisk, level: riskLevel, label: riskLabel });
            setSmartAlerts(upcomingAlerts.slice(0, 3)); // Top 3 alerts

            // --- AI Recommendation ---
            let aiRec = { text: "الأمور مستقرة، استمر في العمل الجيد! 👍", type: "success" };
            if (collectionRate < 70) {
                aiRec = { text: "💡 التوصية: نسبة التحصيل منخفضة. ركز جهودك على الاتصال بالعملاء المتأخرين هذا الأسبوع.", type: "warning" };
            } else if (lowStockCount > 5) {
                aiRec = { text: "💡 التوصية: المخزون ينفد! قم بطلب شحنة جديدة للمنتجات الأكثر مبيعاً لتفادي توقف المبيعات.", type: "warning" };
            } else if (calculatedRisk > 50) {
                aiRec = { text: "⚠️ تحذير: مؤشر المخاطر مرتفع. ننصح بتقليل البيع بالتقسيط المؤقت حتى تحسين التحصيل.", type: "danger" };
            }
            setRecommendation(aiRec);


            // --- 4. Customer Health Chart ---
            const lateCount = lateCustomerIds.size;
            const goodCount = (customersCount || 0) - lateCount;
            const customerHealth = [
                { name: 'منتظم', value: goodCount > 0 ? goodCount : 0, color: '#10B981' }, // Emerald-500
                { name: 'متعثر', value: lateCount, color: '#EF4444' } // Red-500
            ];

            // --- 1. Sales Trend (Last 30 Days) ---
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: trendSales } = await supabase
                .from("sales")
                .select("created_at, total_amount")
                .gte("created_at", thirtyDaysAgo.toISOString())
                .neq("status", "cancelled")
                .order("created_at");

            const trendMap = {};
            trendSales?.forEach(sale => {
                const date = sale.created_at.split('T')[0];
                trendMap[date] = (trendMap[date] || 0) + sale.total_amount;
            });
            const salesTrend = Object.keys(trendMap).map(date => ({ date: new Date(date).toLocaleDateString("en-GB"), amount: trendMap[date] })).slice(-10);

            // --- 2. Product Analysis (Profit vs Volume) ---
            // Fetch sales items from ACTIVE sales only
            const { data: productItems } = await supabase
                .from("sale_items")
                .select("quantity, unit_price, products(name, purchase_price)")
                .limit(1000); // Sample for performance

            const productProfitMap = {};
            const productVolumeMap = {};

            productItems?.forEach(item => {
                const name = item.products?.name || "Unknown";
                const purchasePrice = item.products?.purchase_price || 0;
                // Profit = (Selling Price - Buy Price) * Qty
                // Note: accurate if unit_price reflects the real selling price per unit
                const profit = (item.unit_price - purchasePrice) * item.quantity;

                productProfitMap[name] = (productProfitMap[name] || 0) + profit;
                productVolumeMap[name] = (productVolumeMap[name] || 0) + item.quantity;
            });

            // Top Selling (Volume)
            const topProducts = Object.keys(productVolumeMap)
                .map(name => ({ name, value: productVolumeMap[name] }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

            // Top Profitable (Profit)
            const profitableProducts = Object.keys(productProfitMap)
                .map(name => ({ name, value: productProfitMap[name] }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);


            // --- 5. Payment Forecast (This Month) ---
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

            const { data: monthInstallments } = await supabase
                .from("installments")
                .select("amount, due_date, is_paid")
                .gte("due_date", startOfMonth)
                .lte("due_date", endOfMonth);

            let expectedMonth = 0;
            let collectedMonth = 0;
            monthInstallments?.forEach(inst => {
                expectedMonth += inst.amount;
                if (inst.is_paid) collectedMonth += inst.amount;
            });

            const paymentForecast = [
                { name: 'المتوقع', amount: expectedMonth },
                { name: 'المحصل', amount: collectedMonth }
            ];

            setStats({
                todaySales,
                todaySalesCount: salesData?.length || 0,
                totalCustomers: customersCount || 0,
                overdueAmount: overdueAmt,
                lowStockCount: lowStockCount || 0,
                collectionRate,
                totalCollected,
                totalRemaining
            });

            setChartData({
                salesTrend,
                topProducts,
                profitableProducts,
                customerHealth,
                paymentForecast
            });

        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    }

    // 2. Calculate Financial Analytics (Details)
    async function calculateAnalytics() {
        setCalculating(true);
        try {
            // Fetch ALL Sales in Range
            const { data: sales, error } = await supabase
                .from("sales")
                .select(`
                    id, 
                    sale_type, 
                    total_amount,
                    installment_months, 
                    monthly_installment_amount,
                    created_at,
                    sale_items (
                        quantity,
                        unit_price,
                        products (
                            purchase_price
                        )
                    )
                `)
                .neq("status", "cancelled")
                .gte("created_at", dateFilter.startDate + "T00:00:00")
                .lte("created_at", dateFilter.endDate + "T23:59:59");

            if (error) throw error;

            let instStats = { revenue: 0, cost: 0, count: 0 };
            let cashStats = { revenue: 0, cost: 0, count: 0 };

            sales.forEach(sale => {
                let saleRevenue = 0;
                let saleCost = 0;

                // Calculate Cost for this sale
                sale.sale_items.forEach(item => {
                    const costPrice = item.products?.purchase_price || 0;
                    saleCost += costPrice * item.quantity;
                });

                if (sale.sale_type === 'installment') {
                    // Installment Revenue = Monthly * Months
                    saleRevenue = (sale.monthly_installment_amount || 0) * (sale.installment_months || 0);
                    instStats.revenue += saleRevenue;
                    instStats.cost += saleCost;
                    instStats.count++;
                } else {
                    // Cash Revenue = Total Amount
                    saleRevenue = sale.total_amount || 0;
                    cashStats.revenue += saleRevenue;
                    cashStats.cost += saleCost;
                    cashStats.count++;
                }
            });

            setAnalytics({
                installment: {
                    ...instStats,
                    profit: instStats.revenue - instStats.cost
                },
                cash: {
                    ...cashStats,
                    profit: cashStats.revenue - cashStats.cost
                },
                total: {
                    revenue: instStats.revenue + cashStats.revenue,
                    cost: instStats.cost + cashStats.cost,
                    profit: (instStats.revenue - instStats.cost) + (cashStats.revenue - cashStats.cost)
                }
            });

        } catch (err) {
            console.error("Analytics Error:", err);
            alert("حدث خطأ في الحسابات: " + err.message);
        } finally {
            setCalculating(false);
        }
    }

    useEffect(() => {
        fetchStats();
        calculateAnalytics();
    }, []);

    // UI Components
    const TooltipHelp = ({ text }) => (
        <div className="group relative inline-block mr-2 cursor-help">
            <HelpCircle size={14} className="text-gray-400 hover:text-indigo-600 transition-colors" />
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs rounded-lg p-2 text-center shadow-lg z-50">
                {text}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-custom-triangle"></div>
            </div>
        </div>
    );

    const StatCard = ({ title, value, subtext, icon: Icon, color, loading, help }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:shadow-md transition-shadow relative overflow-hidden">
            <div>
                <div className="flex items-center mb-1">
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    {help && <TooltipHelp text={help} />}
                </div>
                {loading ? (
                    <div className="h-8 w-24 bg-gray-100 rounded animate-pulse"></div>
                ) : (
                    <h3 className={`text-3xl font-bold tracking-tight ${color}`}>{value}</h3>
                )}
                {subtext && <p className="text-xs mt-2 font-medium text-gray-400">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl opacity-80 ${color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('700', '100')}`}>
                <Icon size={24} className={color} />
            </div>
        </div>
    );

    // Helper Card for Financials
    const FinancialCard = ({ title, revenue, cost, profit, count, color }) => {
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return (
            <div className={`p-6 rounded-2xl border ${color === 'blue' ? 'bg-blue-50 border-blue-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <h4 className={`font-bold text-lg mb-4 flex items-center justify-between ${color === 'blue' ? 'text-blue-800' : 'text-emerald-800'}`}>
                    <span>{title}</span>
                    <span className="text-xs bg-white px-2 py-1 rounded-full shadow-sm opacity-75">{count} عملية</span>
                </h4>

                <div className="space-y-4">
                    {/* Cost */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">تكلفة السلع (رأس المال):</span>
                        <span className="font-bold text-gray-700">{cost.toLocaleString()} د.ج</span>
                    </div>

                    {/* Revenue */}
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">سعر البيع الاجمالي:</span>
                        <span className="font-bold text-gray-700">{revenue.toLocaleString()} د.ج</span>
                    </div>

                    <div className="h-px bg-gray-200 my-2"></div>

                    {/* Profit */}
                    <div className="flex justify-between items-center">
                        <span className={`font-bold ${color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>صافي الربح:</span>
                        <div className="text-right">
                            <div className={`text-xl font-black ${color === 'blue' ? 'text-blue-900' : 'text-emerald-900'}`}>{profit.toLocaleString()} <span className="text-xs">د.ج</span></div>
                            <div className="text-[10px] text-gray-400 font-bold mt-0.5">هامش: %{margin.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header with Smart Alerts */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">مركز ذكاء الأعمال (BI)</h2>
                        <p className="text-sm text-gray-500">نظام تحليل استراتيجي مدعوم بالذكاء الاصطناعي</p>
                    </div>
                    <button onClick={() => { fetchStats(); calculateAnalytics(); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تحديث البيانات">
                        <RefreshCcw size={20} className={loading || calculating ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Smart Alert Ribbon */}
                {smartAlerts.length > 0 && (
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between mb-6 animate-fade-in-down">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg"><Bell size={20} className="text-orange-600" /></div>
                            <div>
                                <h4 className="font-bold text-orange-800 text-sm">تنبيهات المتابعة (قريباً)</h4>
                                <p className="text-xs text-orange-600 mt-1">
                                    المستحقات القادمة خلال 7 أيام لـ: {smartAlerts.map(a => a.customer).join('، ')}
                                </p>
                            </div>
                        </div>
                        <button className="text-xs bg-white border border-orange-200 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-600 hover:text-white transition-colors">عرض التفاصيل</button>
                    </div>
                )}
            </div>

            {/* 1. Risk Meter & Recommendation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* AI Recommendation */}
                <div className={`lg:col-span-3 p-6 rounded-2xl border flex items-center gap-4 shadow-sm ${recommendation.type === 'warning' ? 'bg-amber-50 border-amber-100' : recommendation.type === 'danger' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className={`p-3 rounded-full ${recommendation.type === 'warning' ? 'bg-amber-200' : recommendation.type === 'danger' ? 'bg-red-200' : 'bg-indigo-200'}`}>
                        <Zap size={24} className={recommendation.type === 'warning' ? 'text-amber-700' : recommendation.type === 'danger' ? 'text-red-700' : 'text-indigo-700'} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm mb-1 uppercase tracking-wide">💡 توصية الذكاء الاصطناعي</h4>
                        <p className="text-gray-700 font-medium text-sm leading-relaxed">{recommendation.text}</p>
                    </div>
                </div>

                {/* Risk Meter */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                    <h4 className="text-xs font-bold text-gray-400 absolute top-4 right-4">مقياس المخاطر</h4>
                    <div className="relative z-10 text-center">
                        <div className={`text-5xl font-black mb-1 ${getStatusColor(riskMetrics.score, 'risk')}`}>
                            {riskMetrics.level}
                        </div>
                        <p className="text-sm font-bold text-gray-500">{riskMetrics.label}</p>
                    </div>
                    <div className={`absolute bottom-0 left-0 h-2 transition-all duration-1000 ${riskMetrics.level === 'High' ? 'bg-red-500 w-full' : riskMetrics.level === 'Medium' ? 'bg-yellow-500 w-2/3' : 'bg-green-500 w-1/3'}`}></div>
                </div>
            </div>


            {/* 2. Master KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Collection Rate */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:shadow-lg transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-100 to-transparent rounded-bl-full opacity-50"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <p className="text-gray-500 text-sm font-medium">نسبة التحصيل</p>
                            <TooltipHelp text="نسبة الأموال التي تم جمعها مقارنة بالمستحق. النسب فوق 90% ممتازة." />
                        </div>
                        <Percent size={20} className="text-indigo-600" />
                    </div>
                    <div className="relative z-10">
                        <h3 className={`text-4xl font-black ${getStatusColor(stats.collectionRate, 'rate')}`}>
                            {stats.collectionRate.toFixed(1)}%
                        </h3>
                        <div className="flex justify-between text-xs text-gray-400 mt-4 pt-4 border-t border-gray-50">
                            <span>✅ حصلت: {stats.totalCollected.toLocaleString()}</span>
                            <span>⏳ باقي: {stats.totalRemaining.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <StatCard
                    title="تكلفة التأخير"
                    value={`${stats.overdueAmount.toLocaleString()} د.ج`}
                    subtext="أموال مجمدة بسبب التأخير"
                    icon={AlertOctagon}
                    color="text-red-600"
                    loading={loading}
                    help="مجموع الأقساط التي حان موعدها ولم تدفع بعد. هذا الرقم يمثل خطراً على السيولة."
                />
                <StatCard
                    title="مبيعات اليوم"
                    value={`${stats.todaySales.toLocaleString()} د.ج`}
                    subtext={`${stats.todaySalesCount} عملية جديدة`}
                    icon={TrendingUp}
                    color="text-emerald-600"
                    loading={loading}
                />
                <StatCard
                    title="الزبائن المسجلين"
                    value={stats.totalCustomers}
                    subtext="قاعدة العملاء الكلية"
                    icon={Users}
                    color="text-blue-600"
                    loading={loading}
                />
            </div>

            {/* 3. Visual Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Sales Trend */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Activity size={18} className="text-indigo-600" />
                        اتجاه المبيعات (آخر 30 يوم)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.salesTrend}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} reverse />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => value.toLocaleString() + " د.ج"} />
                                <Area type="monotone" dataKey="amount" stroke="#8884d8" fillOpacity={1} fill="url(#colorAmount)" name="المبيعات" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Customer Health (Donut) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Users size={18} className="text-blue-600" />
                            صحة العملاء
                        </h3>
                        <TooltipHelp text="نسبة العملاء الملتزمين بالسداد مقابل المتعثرين." />
                    </div>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.customerHealth}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.customerHealth.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                            <p className="text-2xl font-bold text-gray-800">{stats.totalCustomers}</p>
                            <p className="text-xs text-gray-400">إجمالي</p>
                        </div>
                    </div>
                </div>

                {/* Top Profitable Products (Bar) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <DollarSign size={18} className="text-emerald-600" />
                            الأكثر ربحية
                        </h3>
                        <TooltipHelp text="المنتجات التي تحقق أعلى صافي ربح (ليس مجرد مبيعات)." />
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.profitableProducts} layout="vertical" margin={{ left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(value) => value.toLocaleString() + " د.ج (ربح)"} />
                                <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Forecast (Existing) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Calendar size={18} className="text-purple-600" />
                        توقعات تحصيل هذا الشهر
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.paymentForecast}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => value.toLocaleString()} />
                                <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="المبلغ" barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Products Volume (Existing) */}
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Package size={18} className="text-orange-500" />
                        الأكثر مبيعاً (كمية)
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.topProducts}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {chartData.topProducts.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* 3. Advanced Financial Calculator (Existing) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Calculator className="text-indigo-600" />
                        حاسبة الأرباح التفصيلية
                    </h3>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 px-2 text-sm text-gray-500">
                            <Filter size={16} />
                            <span>الفترة:</span>
                        </div>
                        <input
                            type="date"
                            value={dateFilter.startDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                        />
                        <span className="text-gray-400">إلى</span>
                        <input
                            type="date"
                            value={dateFilter.endDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                        />
                        <button
                            onClick={calculateAnalytics}
                            disabled={calculating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {calculating ? "..." : "احسب"}
                        </button>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Installment Breakdown */}
                    <FinancialCard
                        title="مبيعات التقسيط"
                        revenue={analytics.installment.revenue}
                        cost={analytics.installment.cost}
                        profit={analytics.installment.profit}
                        count={analytics.installment.count}
                        color="blue"
                    />

                    {/* Cash Breakdown */}
                    <FinancialCard
                        title="مبيعات الكاش (نقد)"
                        revenue={analytics.cash.revenue}
                        cost={analytics.cash.cost}
                        profit={analytics.cash.profit}
                        count={analytics.cash.count}
                        color="green"
                    />
                </div>

                {/* Grand Total Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-gray-500 text-sm font-bold">إجمالي الربح الصافي في هذه الفترة: <span className="text-indigo-700 text-lg mx-2">{analytics.total.profit.toLocaleString()} د.ج</span></p>
                </div>
            </div>

        </div>

    );
}
