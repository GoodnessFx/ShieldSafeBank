import { createBrowserRouter } from 'react-router';
import Root from './layouts/Root';
import AdminRoot from './layouts/AdminRoot';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import Security from './pages/Security';
import Fees from './pages/Fees';
import PersonalBanking from './pages/PersonalBanking';
import BusinessBanking from './pages/BusinessBanking';
import About from './pages/About';
import Support from './pages/Support';
import Legal from './pages/Legal';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmailVerification from './pages/EmailVerification';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import AdminLogin from './pages/admin/AdminLogin';
import AdminConsole from './pages/admin/AdminConsole';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: 'how-it-works', Component: HowItWorks },
      { path: 'security', Component: Security },
      { path: 'fees', Component: Fees },
      { path: 'personal', Component: PersonalBanking },
      { path: 'business', Component: BusinessBanking },
      { path: 'about', Component: About },
      { path: 'support', Component: Support },
      { path: 'legal', Component: Legal },
      { path: 'login', Component: Login },
      { path: 'signup', Component: SignUp },
      { path: 'forgot-password', Component: ForgotPassword },
      { path: 'reset-password', Component: ResetPassword },
      { path: 'verify-email', Component: EmailVerification },
      { path: 'dashboard', Component: Dashboard },
      { path: '*', Component: NotFound },
    ],
  },
  {
    path: '/xk9-admin-console-7f3a',
    Component: AdminRoot,
    children: [
      { index: true, Component: AdminLogin },
      { path: 'console', Component: AdminConsole },
    ],
  },
]);
