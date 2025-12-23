import { useState } from 'react';
import { Mail, ArrowRightLeft, History } from 'lucide-react';
import PostalExport from '../components/PostalExport';
import PostalImport from '../components/PostalImport';

export default function PostalPage() {
    const [activeTab, setActiveTab] = useState('operations');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
                    <Mail size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-800">إدارة البريد (CCP)</h1>
                    <p className="text-gray-500">تصدير الاقتطاعات الشهرية ومعالجة الردود الآلية</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Export (Month's Files) */}
                <div className="bg-yellow-50/50 p-6 rounded-2xl border border-yellow-100 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-yellow-200 flex items-center justify-center font-bold text-yellow-700">1</div>
                        <h2 className="text-xl font-bold text-gray-800">تصدير الملفات</h2>
                    </div>
                    <PostalExport />
                </div>

                {/* Right: Import (Processing) */}
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700">2</div>
                        <h2 className="text-xl font-bold text-gray-800">معالجة الردود</h2>
                    </div>
                    <PostalImport onSuccess={() => alert("تم تحديث حالات الأقساط بنجاح!")} />
                </div>

            </div>

            {/* Info / Stats Section (Placeholder for Phase 6) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-50">
                <h3 className="font-bold text-gray-400 flex items-center gap-2">
                    <History size={20} />
                    سجل العمليات (قريباً)
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                    سيتم هنا عرض أرشيف لجميع ملفات البريد التي تم تصديرها واستيرادها سابقاً.
                </p>
            </div>
        </div>
    );
}
