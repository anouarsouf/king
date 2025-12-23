import { useEffect, useState } from "react";
import { Plus, Search, Truck, Edit, Trash2, User, LayoutGrid, List as ListIcon } from "lucide-react";
import { supabase } from "../supabase";
import SupplierModal from "../components/SupplierModal";

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [supplierToEdit, setSupplierToEdit] = useState(null);
    const [displayMode, setDisplayMode] = useState("list"); // 'grid' or 'list'

    async function fetchSuppliers() {
        setLoading(true);
        const { data, error } = await supabase
            .from("suppliers")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) console.error(error);
        else setSuppliers(data || []);
        setLoading(false);
    }

    useEffect(() => {
        fetchSuppliers();
    }, []);

    async function handleDelete(id) {
        if (!window.confirm("هل أنت متأكد من حذف هذا المورد؟")) return;
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) {
            alert("خطأ في حذف المورد (ربما لديه فواتير مرتبطة): " + error.message);
        } else {
            fetchSuppliers();
        }
    }

    const filteredSuppliers = suppliers.filter(s =>
        (s.first_name + " " + s.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                    <Truck className="text-orange-600" />
                    إدارة الموردين
                </h2>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="بحث بالاسم أو الهاتف..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        />
                    </div>

                    <div className="flex gap-2 border-l pl-2 ml-2 border-gray-200">
                        <button
                            onClick={() => setDisplayMode("grid")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'grid' ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض شبكي"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setDisplayMode("list")}
                            className={`p-2 rounded-lg transition-colors ${displayMode === 'list' ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}
                            title="عرض قائمة"
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => { setSupplierToEdit(null); setIsModalOpen(true); }}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md font-bold"
                    >
                        <Plus size={20} />
                        <span>مورد جديد</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">جاري تحميل الموردين...</div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                    لا يوجد موردين مطابقين للبحث.
                </div>
            ) : displayMode === 'grid' ? (
                // GRID VIEW
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSuppliers.map(supplier => (
                        <div key={supplier.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setSupplierToEdit(supplier); setIsModalOpen(true); }}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(supplier.id)}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xl">
                                    {supplier.first_name[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{supplier.first_name} {supplier.last_name}</h3>
                                    <p className="text-sm text-gray-500">{supplier.phone || "لا يوجد رقم"}</p>
                                </div>
                            </div>

                            {supplier.address && (
                                <div className="pt-3 border-t border-gray-50 text-sm text-gray-600 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                    {supplier.address}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                // LIST VIEW (New)
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                            <tr>
                                <td className="p-4">الاسم واللقب</td>
                                <td className="p-4">رقم الهاتف</td>
                                <td className="p-4">العنوان</td>
                                <td className="p-4"></td>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSuppliers.map(supplier => (
                                <tr key={supplier.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-4 font-bold text-gray-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-sm">
                                            {supplier.first_name[0]}
                                        </div>
                                        {supplier.first_name} {supplier.last_name}
                                    </td>
                                    <td className="p-4 text-gray-600 dir-ltr text-right">{supplier.phone || "-"}</td>
                                    <td className="p-4 text-gray-600">{supplier.address || "-"}</td>
                                    <td className="p-4 flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setSupplierToEdit(supplier); setIsModalOpen(true); }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="تعديل"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <SupplierModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                supplierToEdit={supplierToEdit}
                onSuccess={fetchSuppliers}
            />
        </div>
    );
}
