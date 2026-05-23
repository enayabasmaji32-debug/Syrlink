import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Company from './pages/Company';
import Companies from './pages/Companies';
import Network from './pages/Network';
import Jobs from './pages/Jobs';
import MyApplications from './pages/MyApplications';
import Messaging from './pages/Messaging';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminPanel from './pages/AdminPanel';
import MyCompanyRequests from './pages/MyCompanyRequests';
import PositionRequests from './pages/PositionRequests';
import VerifyEmail from './pages/VerifyEmail';
import EditCompany from './pages/EditCompany';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import NDA from './pages/NDA';
import { ForgotPassword, ResetPassword } from './pages/PasswordReset';
import { Toaster } from './components/ui/sonner';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, remountKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    const msg = (error && error.message) || '';
    // For transient DOM reconciliation errors (often caused by browser
    // extensions like Google Translate), silently remount the tree instead
    // of reloading the page. Reloading triggers token revalidation which
    // can bounce the user to /login on a slow network.
    if (msg.includes('insertBefore') || msg.includes('removeChild') || msg.includes('Node')) {
      setTimeout(() => {
        this.setState((s) => ({ hasError: false, error: null, remountKey: s.remountKey + 1 }));
      }, 50);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center bg-[#f4f2ee]">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <p className="text-sm text-gray-600">جارٍ إعادة تحميل الصفحة...</p>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.remountKey}>{this.props.children}</React.Fragment>;
  }
}

function Loading() {
  return (
    <div className="min-h-screen grid place-items-center bg-[#f4f2ee]">
      <div className="flex flex-col items-center gap-3">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-16 h-16 object-contain animate-pulse" />
        <p className="text-sm text-gray-600">Loading SyrLink…</p>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, authReady } = useApp();
  const location = useLocation();
  if (!authReady) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <>
      <Navbar />
      <main className="pt-[60px]">{children}</main>
    </>
  );
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/nda" element={<NDA />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Protected><Feed /></Protected>} />
      <Route path="/feed" element={<Navigate to="/" replace />} />
      <Route path="/in/:userId" element={<Protected><Profile /></Protected>} />
      <Route path="/me" element={<Protected><Profile /></Protected>} />
      <Route path="/me/edit" element={<Protected><EditProfile /></Protected>} />
      <Route path="/company/:companyId" element={<Protected><Company /></Protected>} />
      <Route path="/company/:companyId/edit" element={<Protected><EditCompany /></Protected>} />
      <Route path="/companies" element={<Protected><Companies /></Protected>} />
      <Route path="/my-company-requests" element={<Protected><MyCompanyRequests /></Protected>} />
      <Route path="/position-requests" element={<Protected><PositionRequests /></Protected>} />
      <Route path="/mynetwork" element={<Protected><Network /></Protected>} />
      <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
      <Route path="/my-applications" element={<Protected><MyApplications /></Protected>} />
      <Route path="/messaging" element={<Protected><Messaging /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPanel /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <div className="App">
            <Shell />
            <Toaster position="bottom-center" />
          </div>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
