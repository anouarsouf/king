import { useEffect, useState } from "react";
import { Building2, Plus, LayoutGrid, List as ListIcon, Edit, Trash2 } from "lucide-react";
import { supabase } from "../supabase";

export default function Branches() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [displayMode, setDisplayMode] = useState("list"); // 'grid' or 'list'

    // Branch Modal
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [branchForm, setBranchForm] = useState({ name: "", location: "", reference_prefix: "", address: "", phone: "", wilaya: "" });

    async function fetchData() {
        setLoading(true);
        const { data: bData } = await supabase.from("branches").select("*");
        setBranches(bData || []);
        setLoading(false);
    }

    useEffect(() => {
        fetchData();
    }, []);

    function openBranchModal(branch = null) {
        if (branch) {
            setEditingBranch(branch);
            setBranchForm({
                name: branch.name,
                location: branch.location || "",
                reference_prefix: branch.reference_prefix || "",
                address: branch.address || "",
                phone: branch.phone || "",
                wilaya: branch.wilaya || ""
            });
        } else {
            setEditingBranch(null);
            setBranchForm({ name: "", location: "", reference_prefix: "", address: "", phone: "", wilaya: "" });
        }
        setIsBranchModalOpen(true);
    }

    async function handleBranchSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            if (editingBranch) {
                const { error } = await supabase.from("branches").update(branchForm).eq("id", editingBranch.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("branches").insert([branchForm]);
                if (error) throw error;
            }
            setIsBranchModalOpen(false);
            fetchData();
        } catch (err) {
            alert("خطأ: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteBranch(id) {
        if (!window.confirm("حذف هذا الفرع؟\n\nتنبيه: لا يمكن حذف الفرع إذا كان يحتوي على مبيعات أو مخزون أو تحويلات سابقة.")) return;

        try {
            const { error } = await supabase.from("branches").delete().eq("id", id);
            if (error) {
                // Check if error is Foreign Key Violation (Postgres code 23503)
                if (error.code === '23503') {
                    throw new Error("عذراً، هذا الفرع مرتبط ببيانات أخرى (مبيعات، مخزون، أو تحويلات).\nيجب حذف السجلات المرتبطة به أولاً.");
                }
                throw error;
            }
            fetchData();
        } catch (err) {
            alert("تعذر الحذف: " + err.message);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center w-full md:w-auto gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                            <Building2 className="text-indigo-600" size={28} />
                            إدارة الفروع (المحلات)
                        </h2>
                        <p className="text-gray-500 mt-1">إضافة وتعديل بيانات الفروع ونقاط البيع</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                    <div className="flex gap-2 border-l pl-2 ml-2 border-gray-200">
                        <button
                            onClick={() => setDisplayMode("grid")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض شبكي"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setDisplayMode("list")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض قائمة"
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => openBranchModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200"
                    >
                        <Plus size={20} />
                        إضافة فرع جديد
                    </button>
                </div>
            </div>

            {/* Branches List/Grid */}
            {displayMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {branches.map(branch => (
                        <div key={branch.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
                            <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500"></div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-gray-800">{branch.name}</h3>
                                {branch.reference_prefix && (
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold font-mono">
                                        REF: {branch.reference_prefix}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-1 mb-4">
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <Building2 size={14} />
                                    {branch.location || "فرع محلي"}
                                </p>
                                {branch.wilaya && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 inline-block">{branch.wilaya}</span>}
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                                <button onClick={() => openBranchModal(branch)} className="flex-1 bg-gray-50 text-indigo-600 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50">تعديل</button>
                                <button onClick={() => handleDeleteBranch(branch.id)} className="flex-1 bg-gray-50 text-red-600 py-2 rounded-lg text-sm font-bold hover:bg-red-50">حذف</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                            <tr>
                                <td className="p-4">اسم الفرع</td>
                                <td className="p-4">الولاية</td>
                                <td className="p-4">الرمز (Prefix)</td>
                                <td className="p-4">الموقع</td>
                                <td className="p-4"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {branches.map(branch => (
                                <tr key={branch.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-800">{branch.name}</td>
                                    <td className="p-4 text-gray-600">{branch.wilaya || "-"}</td>
                                    <td className="p-4 font-mono font-bold text-blue-600">{branch.reference_prefix || "-"}</td>
                                    <td className="p-4 text-gray-500">{branch.location || "-"}</td>
                                    <td className="p-4 flex justify-end gap-2">
                                        <button onClick={() => openBranchModal(branch)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                        <button onClick={() => handleDeleteBranch(branch.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Branch Modal */}
            {isBranchModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
                            </h3>
                            <button onClick={() => setIsBranchModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <form onSubmit={handleBranchSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">اسم الفرع</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                    value={branchForm.name}
                                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">الولاية</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="مثلاً: الجزائر"
                                    value={branchForm.wilaya}
                                    onChange={e => setBranchForm({ ...branchForm, wilaya: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">العنوان الكامل</label>
                                <textarea
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                                    placeholder="الحي، الشارع، الرقم..."
                                    value={branchForm.address}
                                    onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right"
                                    placeholder="0550..."
                                    value={branchForm.phone}
                                    onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">رمز المرجع (Prefix) - حرف واحد</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-center uppercase"
                                    maxLength="1"
                                    placeholder="A, B, C..."
                                    required
                                    value={branchForm.reference_prefix}
                                    onChange={e => setBranchForm({ ...branchForm, reference_prefix: e.target.value.toUpperCase() })}
                                />
                                <p className="text-xs text-gray-500 mt-1">يستخدم لتوليد أكواد المراجع (مثلاً A1, A2)</p>
                            </div>
                            <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700">
                                حفظ البيانات
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
