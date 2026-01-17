import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import InvoiceDetail from './pages/InvoiceDetail';
import Clients from './pages/Clients';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Dashboard tabs as routes - Chat is the default */}
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<Dashboard />} />
        <Route path="/chat/:sessionId" element={<Dashboard />} />
        <Route path="/manual" element={<Dashboard />} />
        
        {/* Other pages */}
        <Route path="/clients" element={<Clients />} />
        <Route path="/history" element={<History />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        
        {/* Fallback - redirect unknown routes to chat */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
