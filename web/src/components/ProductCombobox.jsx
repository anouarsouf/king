import { useState, useEffect, useRef } from "react";
import { Search, Check, ChevronsUpDown } from "lucide-react";

export default function ProductCombobox({ products, onSelect, selectedId }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const wrapperRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Find selected name
    useEffect(() => {
        const selected = products.find(p => p.id == selectedId);
        if (selected) setValue(selected.name);
        else setValue("");
    }, [selectedId, products]); // eslint-disable-next-line react-hooks/exhaustive-deps

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase())
    );

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    placeholder="ابحث واختر المنتج..."
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    className="w-full p-2 pr-8 border border-gray-300 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                />
                <ChevronsUpDown className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>

            {open && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filtered.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">لا يوجد نتائج.</div>
                    ) : (
                        filtered.map((product) => (
                            <div
                                key={product.id}
                                className="p-2 hover:bg-purple-50 cursor-pointer text-sm flex justify-between items-center group"
                                onClick={() => {
                                    setValue(product.name);
                                    onSelect(product.id);
                                    setOpen(false);
                                }}
                            >
                                <span className="font-medium text-gray-700">{product.name}</span>
                                {product.id == selectedId && <Check size={14} className="text-purple-600" />}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
