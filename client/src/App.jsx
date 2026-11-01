import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer.jsx';
import FloatingAssistant from './components/FloatingAssistant.jsx';
import Loading from './components/Loading.jsx';
import Navbar from './components/Navbar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Assistant from './pages/Assistant.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import MyReports from './pages/MyReports.jsx';
import Register from './pages/Register.jsx';
import ReportIssue from './pages/ReportIssue.jsx';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/report" element={<ProtectedRoute roles={['citizen']}><ReportIssue /></ProtectedRoute>} />
          <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute roles={['citizen']}><Assistant /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <FloatingAssistant />
      <Footer />
    </>
  );
}
