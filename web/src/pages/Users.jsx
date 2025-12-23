import { useState, useEffect } from "react";
import { Users as UsersIcon, Search, ShieldCheck, ShieldAlert, Loader2, Lock, X, Crown, Briefcase, User, Plus, Save, Trash2, Key, Edit, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "../supabase";
import { createClient } from "@supabase/supabase-js";

export default function Users() {
    const [profiles, setProfiles] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [updating, setUpdating] = useState(null); // id of user being updated (role/branch)

    // Action States
    const [targetUser, setTargetUser] = useState(null); // The user being acted upon

    // Modals State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isEditNameOpen, setIsEditNameOpen] = useState(false);

    // Form Data
    const [newUser, setNewUser] = useState({ email: "", password: "", fullName: "", role: "employee", branchId: "" });
    const [newPassword, setNewPassword] = useState("");
    const [newName, setNewName] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        // Fetch Branches
        const { data: branchesData } = await supabase.from('branches').select('*');
        setBranches(branchesData || []);

        // Fetch Profiles (Users)
        const { data: profilesData, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false, nullsFirst: false });

        if (error) {
            console.error("Error fetching profiles:", error);
        } else {
            setProfiles(profilesData || []);
        }
        setLoading(false);
    }

    // --- 1. DIRECT UPDATE (Role / Branch) ---
    async function updateProfileField(userId, changes) {
        setUpdating(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update(changes)
                .eq('id', userId);

            if (error) throw error;

            setProfiles(profiles.map(p => p.id === userId ? { ...p, ...changes } : p));
        } catch (error) {
            alert("فشل التحديث: " + error.message);
        } finally {
            setUpdating(null);
        }
    }

    // --- 2. ADD USER ---
    async function handleAddUser(e) {
        e.preventDefault();
        setProcessing(true);
        try {
            // CRITICAL: Disable persistence for temp client
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
            );

            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: newUser.email,
                password: newUser.password,
                options: { data: { full_name: newUser.fullName } }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("فشل إنشاء المستخدم");

            // Upsert Profile
            const newUserId = authData.user.id;
            const updates = {
                id: newUserId,
                full_name: newUser.fullName,
                role: newUser.role,
                branch_id: newUser.branchId === "" || newUser.branchId === "null" ? null : newUser.branchId,
                email: newUser.email // Save email for display
            };

            const { error: updateError } = await supabase.from('profiles').upsert(updates);
            if (updateError) throw updateError;

            setIsAddOpen(false);
            setNewUser({ email: "", password: "", fullName: "", role: "employee", branchId: "" });
            fetchData();
            alert("✅ تم إنشاء الموظف بنجاح!");

        } catch (error) {
            alert("خطأ: " + error.message);
        } finally {
            setProcessing(false);
        }
    }

    // --- 3. RESET PASSWORD (RPC) ---
    function openPasswordModal(user) {
        setTargetUser(user);
        setNewPassword("");
        setIsPasswordOpen(true);
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        setProcessing(true);
        try {
            const { error } = await supabase.rpc('admin_reset_password', {
                target_user_id: targetUser.id,
                new_password: newPassword
            });

            if (error) throw error;

            alert("✅ تم تغيير كلمة المرور بنجاح!");
            setIsPasswordOpen(false);
        } catch (error) {
            alert("خطأ: " + error.message);
        } finally {
            setProcessing(false);
        }
    }

    // --- 4. DELETE USER (RPC) ---
    function openDeleteModal(user) {
        setTargetUser(user);
        setIsDeleteOpen(true);
    }

    async function handleDeleteUser() {
        setProcessing(true);
        try {
            const { error } = await supabase.rpc('admin_delete_user', {
                target_user_id: targetUser.id
            });

            if (error) throw error;

            setProfiles(profiles.filter(p => p.id !== targetUser.id));
            alert("✅ تم حذف الموظف نهائياً!");
            setIsDeleteOpen(false);
        } catch (error) {
            alert("خطأ: " + error.message);
        } finally {
            setProcessing(false);
        }
    }

    // --- 5. EDIT NAME ---
    function openEditNameModal(user) {
        setTargetUser(user);
        setNewName(user.full_name || "");
        setIsEditNameOpen(true);
    }

    async function handleEditName(e) {
        e.preventDefault();
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: newName })
                .eq('id', targetUser.id);

            if (error) throw error;

            setProfiles(profiles.map(p => p.id === targetUser.id ? { ...p, full_name: newName } : p));
            setIsEditNameOpen(false);
        } catch (error) {
            alert("خطأ: " + error.message);
        } finally {
            setProcessing(false);
        }
    }

    const filteredProfiles = profiles.filter(p =>
        (p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.includes(searchTerm)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HERDER & ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                        <UsersIcon className="text-blue-600 w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">إدارة المستخدمين</h2>
                        <p className="text-gray-500 text-sm">التحكم الكامل في الصلاحيات والحسابات</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="بحث (اسم، إيميل، معرف)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        <span className="hidden md:inline">إضافة موظف</span>
                    </button>
                </div>
            </div>

            {/* TABLE */}
            {loading ? (
                <div className="text-center py-20 text-gray-500 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                    <p>جاري تحميل البيانات...</p>
                </div>
            ) : filteredProfiles.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-500 font-medium">لا يوجد مستخدمين مطابقين للبحث</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-5">الموظف</th>
                                <th className="p-5">الصلاحية (Role)</th>
                                <th className="p-5">الفرع (Branch)</th>
                                <th className="p-5 text-center">إجراءات المدير</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredProfiles.map(profile => (
                                <tr key={profile.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                                                {(profile.full_name || "?")[0]}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {profile.full_name || "بدون اسم"}
                                                    <button onClick={() => openEditNameModal(profile)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity" title="تعديل الاسم">
                                                        <Edit size={14} />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">{profile.email || "No Email"}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-5">
                                        <div className="relative w-40">
                                            <select
                                                disabled={updating === profile.id}
                                                value={profile.role || 'employee'}
                                                onChange={(e) => updateProfileField(profile.id, { role: e.target.value })}
                                                className={`w-full p-2 pl-8 border rounded-lg text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all ${profile.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        profile.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                    }`}
                                            >
                                                <option value="admin">Admin (مدير عام)</option>
                                                <option value="manager">Manager (مدير فرع)</option>
                                                <option value="employee">Employee (موظف)</option>
                                            </select>
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                {profile.role === 'admin' ? <Crown size={14} className="text-purple-600" /> :
                                                    profile.role === 'manager' ? <Briefcase size={14} className="text-indigo-600" /> :
                                                        <User size={14} className="text-gray-500" />}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-5">
                                        <select
                                            disabled={updating === profile.id}
                                            value={profile.branch_id || "null"}
                                            onChange={(e) => updateProfileField(profile.id, { branch_id: e.target.value === "null" ? null : e.target.value })}
                                            className={`w-40 p-2 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all ${profile.branch_id ? 'bg-white border-gray-300 text-gray-700' : 'bg-gray-50 text-gray-400 italic'
                                                }`}
                                        >
                                            <option value="null">-- عام (كل الفروع) --</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>🏠 {b.name}</option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="p-5">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => openPasswordModal(profile)}
                                                className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                                                title="تغيير كلمة المرور"
                                            >
                                                <Key size={18} />
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(profile)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="حذف الحساب نهائياً"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- MODALS --- */}

            {/* 1. EDIT NAME MODAL */}
            {isEditNameOpen && targetUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">تعديل الاسم</h3>
                            <button onClick={() => setIsEditNameOpen(false)}><X className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleEditName} className="p-6 space-y-4">
                            <input
                                autoFocus
                                type="text"
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="الاسم الجديد"
                            />
                            <button type="submit" disabled={processing} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">
                                {processing ? "جاري الحفظ..." : "حفظ التغييرات"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. PASSWORD RESET MODAL */}
            {isPasswordOpen && targetUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border-t-4 border-yellow-500">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Key className="text-yellow-600" /> تغيير كلمة المرور
                            </h3>
                            <button onClick={() => setIsPasswordOpen(false)}><X className="text-gray-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm">
                                سيتم تغيير كلمة المرور للموظف <strong>{targetUser.full_name}</strong> فوراً.
                            </div>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-700">كلمة المرور الجديدة</label>
                                    <input
                                        autoFocus
                                        required
                                        type="text"
                                        className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-yellow-500 font-mono text-center text-lg mt-1"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="New Password"
                                        minLength={6}
                                    />
                                </div>
                                <button type="submit" disabled={processing} className="w-full bg-yellow-600 text-white py-3 rounded-xl font-bold hover:bg-yellow-700 shadow-lg shadow-yellow-200">
                                    {processing ? "جاري التغيير..." : "تأكيد كلمة المرور الجديدة"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. DELETE CONFIRM MODAL */}
            {isDeleteOpen && targetUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border-t-4 border-red-500">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 mb-2">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">حذف الموظف؟</h3>
                            <p className="text-gray-500">
                                هل أنت متأكد من حذف <strong>{targetUser.full_name}</strong>؟
                                <br />
                                <span className="text-xs text-red-500 font-bold">⚠️ هذا الإجراء لا يمكن التراجع عنه! سيتم حذف الحساب بالكامل.</span>
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsDeleteOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 font-bold text-gray-600 rounded-xl hover:bg-gray-200"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={processing}
                                    className="flex-1 py-3 bg-red-600 font-bold text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-200"
                                >
                                    {processing ? "جاري الحذف..." : "نعم، احذف"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. ADD USER MODAL (Existing logic kept) */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-xl flex items-center gap-2 text-gray-800">
                                <Plus size={24} className="text-blue-600" />
                                إضافة موظف جديد
                            </h3>
                            <button onClick={() => setIsAddOpen(false)}><X className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="p-6 space-y-4">
                            {/* Form Fields (Same as before) */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">الاسم الكامل</label>
                                    <input required type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="محمد أحمد" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">الإيميل</label>
                                    <input required type="email" dir="ltr" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left" placeholder="user@example.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-gray-700">كلمة المرور</label>
                                    <input required type="password" dir="ltr" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left" placeholder="••••••••" minLength={6} />
                                </div>
                            </div>
                            <hr className="border-gray-100 my-2" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">الدور</label>
                                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                        <option value="employee">Employee</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">الفرع</label>
                                    <select value={newUser.branchId} onChange={e => setNewUser({ ...newUser, branchId: e.target.value })} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                        <option value="">-- عام (بدون فرع) --</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold">إلغاء</button>
                                <button type="submit" disabled={processing} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200">{processing ? "جاري الحفظ..." : "حفظ الموظف"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
