import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Listen for changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-gray-500 font-bold">جاري التحقق من الجلسة...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
