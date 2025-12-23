import { useState, useEffect, useRef } from "react";
import { Search, Upload, Printer, FileText, User as UserIcon, Check, Trash2, Image as ImageIcon } from "lucide-react";
import { supabase } from "../supabase";
import { db } from "../db";

export default function Documents() {
    const [searchTerm, setSearchTerm] = useState("");
    const [allCustomers, setAllCustomers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loading, setLoading] = useState(false);

    // Document States (Blobs/URLs)
    const [combinedDoc, setCombinedDoc] = useState(null);

    // Initial Fetch of All Customers (for faster local search)
    useEffect(() => {
        fetchAllCustomers();
    }, []);

    async function fetchAllCustomers() {
        setLoading(true);
        const { data } = await supabase
            .from("customers")
            .select("id, first_name, last_name, ccp_number, ccp_key")
            .order("first_name");

        setAllCustomers(data || []);
        setLoading(false);
    }

    // Search Filtering (Client Side)
    useEffect(() => {
        if (!searchTerm) {
            setSearchResults([]);
            return;
        }

        const lowerTerm = searchTerm.toLowerCase();
        const results = allCustomers.filter(customer =>
            (customer.first_name + " " + customer.last_name).toLowerCase().includes(lowerTerm) ||
            (customer.ccp_number && customer.ccp_number.toString().includes(lowerTerm))
        ).slice(0, 20); // Limit results

        setSearchResults(results);
    }, [searchTerm, allCustomers]);

    // Load Documents when Customer Selected
    useEffect(() => {
        if (!selectedCustomer) {
            setCombinedDoc(null);
            return;
        }

        loadDocuments();
    }, [selectedCustomer]);

    async function loadDocuments() {
        if (!selectedCustomer) return;

        try {
            const doc = await db.documents
                .where({ customerId: selectedCustomer.id, type: 'combined_doc' })
                .first();

            setCombinedDoc(doc ? URL.createObjectURL(doc.blob) : null);
        } catch (err) {
            console.error("Error loading local docs:", err);
        }
    }

    // Handle File Upload (Manual Overwrite)
    async function handleUpload(e) {
        const file = e.target.files[0];
        if (!file || !selectedCustomer) return;

        try {
            // Delete old if exists
            await db.documents
                .where({ customerId: selectedCustomer.id, type: 'combined_doc' })
                .delete();

            // Save new
            await db.documents.add({
                customerId: selectedCustomer.id,
                type: 'combined_doc',
                blob: file,
                created_at: new Date()
            });

            // Refresh view
            loadDocuments();
        } catch (err) {
            alert("خطأ في حفظ الملف محلياً: " + err.message);
        }
    }

    async function handleDeleteDoc() {
        if (!window.confirm("هل أنت متأكد من حذف هذا الملف؟")) return;
        try {
            await db.documents
                .where({ customerId: selectedCustomer.id, type: 'combined_doc' })
                .delete();
            setCombinedDoc(null);
        } catch (err) {
            console.error(err);
        }
    }

    function handlePrint() {
        window.print();
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { visibility: hidden; }
                    .printable-area { 
                        visibility: visible;
                        display: block !important;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        z-index: 9999;
                        padding: 20mm;
                    }
                    .printable-area * { visibility: visible; }
                    .no-print { display: none !important; }
                }
            `}</style>

            {/* Sidebar: Search */}
            <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col no-print">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserIcon className="text-indigo-600" />
                        بحث عن زبون
                    </h2>
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="الاسم أو رقم CCP..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {loading && <p className="text-center text-gray-400 text-sm py-4">جاري تحميل الزبائن...</p>}

                    {!loading && searchResults.length === 0 && searchTerm.length > 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">لا توجد نتائج</p>
                    )}

                    {searchResults.map(customer => (
                        <div
                            key={customer.id}
                            onClick={() => setSelectedCustomer(customer)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${selectedCustomer?.id === customer.id
                                ? "bg-indigo-50 border border-indigo-200"
                                : "hover:bg-gray-50 border border-transparent"
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedCustomer?.id === customer.id ? "bg-indigo-200 text-indigo-700" : "bg-gray-100 text-gray-500"
                                }`}>
                                <UserIcon size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 text-sm">{customer.first_name} {customer.last_name}</p>
                                <p className="text-xs text-gray-500">{customer.ccp_number || "بدون CCP"}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Upload & Preview */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden relative">
                {!selectedCustomer ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4 no-print">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                            <FileText size={40} className="opacity-50" />
                        </div>
                        <p>اختر زبوناً للبدء في إدارة وثائقه</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 no-print">
                            <div>
                                <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <span className="text-indigo-600">{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                                </h2>
                                <p className="text-xs text-gray-500 mt-1 font-mono">CCP: {selectedCustomer.ccp_number} / {selectedCustomer.ccp_key}</p>
                            </div>
                            <div className="flex gap-2">
                                {/* Download Button */}
                                {combinedDoc && (
                                    <a
                                        href={combinedDoc}
                                        download={`Doc_${selectedCustomer.first_name}_${selectedCustomer.last_name}.png`}
                                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                                    >
                                        <Upload size={18} className="rotate-180" />
                                        <span>تنزيل</span>
                                    </a>
                                )}
                                <button
                                    onClick={handlePrint}
                                    disabled={!combinedDoc}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Printer size={18} />
                                    <span>طباعة الوثيقة</span>
                                </button>
                            </div>
                        </div>

                        {/* Document Viewer Zone */}
                        <div className="p-6 flex-1 overflow-y-auto no-print flex flex-col items-center">
                            <div className="w-full h-full max-w-2xl bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                                {combinedDoc ? (
                                    <>
                                        <img src={combinedDoc} alt="Document" className="max-w-full max-h-full object-contain p-4" />
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            <button
                                                onClick={handleDeleteDoc}
                                                className="bg-white/90 p-2 rounded-full text-red-500 shadow hover:bg-red-50 transition-colors"
                                                title="حذف الملف"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center p-8">
                                        <ImageIcon className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-500 font-medium mb-2">لا يوجد ملف مرفق</p>
                                        <p className="text-sm text-gray-400">يمكنك رفع الملف من هنا أو عند تعديل الزبون</p>
                                    </div>
                                )}

                                {/* Manual Upload Overlay */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    title={combinedDoc ? "اضغط لتغيير الملف" : "اضغط لرفع ملف"}
                                />
                            </div>
                        </div>

                        {/* Printable Area (Hidden on Screen) */}
                        <div className="printable-area w-full h-full bg-white p-8 hidden">
                            <div className="text-center w-full border-b pb-4 mb-8">
                                <h1 className="text-2xl font-bold">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</h1>
                                <p className="text-lg text-gray-600 font-mono">CCP: {selectedCustomer?.ccp_number} / {selectedCustomer?.ccp_key}</p>
                            </div>

                            {combinedDoc && (
                                <div className="w-full flex-1 flex items-center justify-center">
                                    <img src={combinedDoc} alt="Document" className="max-w-full max-h-[18cm] object-contain" />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
