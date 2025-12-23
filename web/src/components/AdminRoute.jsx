import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function AdminRoute() {
    const [isAdmin, setIsAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdmin();
    }, []);

    async function checkAdmin() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            // Check profile role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile && profile.role === 'admin') {
                setIsAdmin(true);
            } else {
                setIsAdmin(false);
            }
        } catch (error) {
            console.error("Admin check failed", error);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 max-w-md">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-red-700 mb-2">وصول مرفوض</h2>
                    <p className="text-gray-600 mb-6">
                        عذراً، هذه الصفحة مخصصة للمسؤولين فقط. ليس لديك الصلاحية للوصول إليها.
                    </p>
                    <a href="/" className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors">
                        العودة للرئيسية
                    </a>
                </div>
            </div>
        );
    }

    return <Outlet />;
}
