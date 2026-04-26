import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import CommercialDashboard from "./pages/CommercialDashboard";
import NotFound from "./pages/NotFound";
import AddEditStock from "./pages/AddEditStock";
import AddEditSale from "./pages/AddEditSale";
import StockDetail from "./pages/StockDetail";
import SaleDetail from "./pages/SaleDetail";
import SaleReceipt from "./pages/SaleReceipt";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Account from "./pages/Account";
import SellFromStock from "./pages/SellFromStock";
import CreateUser from "./pages/CreateUser";
import StockPage from "./pages/StockPage";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/painel-comercial" element={<CommercialDashboard />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/stock/add" element={<AddEditStock />} />
          <Route path="/stock/edit/:id" element={<AddEditStock />} />
          <Route path="/stock/:id" element={<StockDetail />} />
          <Route path="/sale/add" element={<AddEditSale />} />
          <Route path="/sale/edit/:id" element={<AddEditSale />} />
          <Route path="/sale/:id" element={<SaleDetail />} />
          <Route path="/sale/:id/receipt" element={<SaleReceipt />} />
          <Route path="/sell/:id" element={<SellFromStock />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/conta" element={<Account />} />
          <Route path="/conta/criar" element={<CreateUser />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
