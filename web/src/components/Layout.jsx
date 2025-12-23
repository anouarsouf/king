import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, ShoppingCart, LogOut, Menu, Package, Truck, ShoppingBag, Wallet, Building2, FileText, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { supabase } from "../supabase";

export default function Layout() {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [userContext, setUserContext] = useState({ name: "", branchName: "جاري التحميل...", isCentralAdmin: false });

    useEffect(() => {
        getProfile();
    }, []);

    async function getProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get Profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            let branchName = "الإدارة المركزية";
            const isAdmin = profile.role === 'admin'; // Correct logic

            if (profile.branch_id) {
                const { data: branch } = await supabase.from('branches').select('name').eq('id', profile.branch_id).single();
                if (branch) branchName = branch.name;
            }
            setUserContext({
                name: profile.full_name || user.email.split('@')[0],
                branchName: branchName,
                isCentralAdmin: isAdmin
            });
        }
    }

    const navItems = [
        { name: "لوحة التحكم", path: "/", icon: LayoutDashboard },
        { name: "الزبائن", path: "/customers", icon: Users },
        { name: "الوثائق (Scanner)", path: "/documents", icon: FileText },
        { name: "إدارة البريد (CCP)", path: "/postal", icon: Mail },
        { name: "المبيعات (العقود)", path: "/sales", icon: ShoppingCart },
        { name: "المشتريات", path: "/purchases", icon: ShoppingBag },
        { name: "إدارة المخزون", path: "/inventory", icon: Package },
        { name: "المنتجات (تعريف)", path: "/products", icon: Package },
        { name: "الموردين", path: "/suppliers", icon: Truck },
        { name: "الخزينة", path: "/treasury", icon: Wallet },
        { name: "الفروع والتحويلات", path: "/branches", icon: Building2 },
    ];

    // Only add Users Management for Central Admin
    if (userContext.isCentralAdmin) {
        navItems.push({ name: "المستخدمين والصلاحيات", path: "/users", icon: Users });
    }

    return (
        <div className="flex h-screen bg-gray-50 text-right" dir="rtl">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-white border-l border-gray-200 transition-all duration-300 flex flex-col",
                    isSidebarOpen ? "w-64" : "w-20"
                )}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
                    <span className={cn("font-bold text-xl text-blue-600", !isSidebarOpen && "hidden")}>
                        تقسيط برو
                    </span>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-md">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                                location.pathname === item.path
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            <item.icon size={20} />
                            <span className={cn("font-medium", !isSidebarOpen && "hidden")}>{item.name}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            // ProtectedRoute will auto-redirect, no need to navigate manually
                        }}
                        className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        <span className={cn("font-medium", !isSidebarOpen && "hidden")}>تسجيل خروج</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <h1 className="text-xl font-bold text-gray-800">
                        {navItems.find((i) => i.path === location.pathname)?.name || "لوحة التحكم"}
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="text-left">
                            <div className="text-sm font-bold text-gray-800">{userContext.name}</div>
                            <div className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                {userContext.branchName}
                            </div>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold uppercase">
                            {userContext.name?.[0] || "U"}
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
