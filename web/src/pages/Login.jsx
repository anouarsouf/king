import { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Successful login
            navigate('/');
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4 text-right" dir="rtl">
            <div className="bg-white/95 backdrop-blur-sm w-full max-w-md p-8 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">

                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                        <Lock className="text-blue-600 w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 mb-2">تسجيل الدخول</h1>
                    <p className="text-gray-500 font-medium">مرحباً بك في نظام تقسيط برو</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm font-bold flex items-center gap-2">
                        ⚠️ {translateError(error)}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
                        <div className="relative">
                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans text-left"
                                placeholder="email@example.com"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">كلمة المرور</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans text-left"
                                placeholder="••••••••"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <span>دخول</span>
                                <ArrowRight className="group-hover:-translate-x-1 transition-transform" size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-gray-400">
                    نظام إدارة المبيعات بالتقسيط - الإصدار 1.0
                </div>
            </div>
        </div>
    );
}

function translateError(msg) {
    if (msg.includes("Invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
    return msg;
}
