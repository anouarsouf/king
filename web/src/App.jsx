import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import Treasury from "./pages/Treasury";
import Branches from "./pages/Branches";
import CustomerPortal from "./pages/CustomerPortal";
import Documents from "./pages/Documents";
import PostalPage from "./pages/PostalPage";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import Users from "./pages/Users";
import AdminRoute from "./components/AdminRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/portal" element={<CustomerPortal />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />

            {/* Admin Only Routes */}
            <Route element={<AdminRoute />}>
              <Route path="users" element={<Users />} />
            </Route>

            <Route path="customers" element={<Customers />} />
            <Route path="sales" element={<Sales />} />
            <Route path="products" element={<Products />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="treasury" element={<Treasury />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="branches" element={<Branches />} />
            <Route path="documents" element={<Documents />} />
            <Route path="postal" element={<PostalPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
