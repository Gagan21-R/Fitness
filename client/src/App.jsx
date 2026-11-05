import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth, useTheme } from './lib/context.jsx';
import AuthPage from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Goals from './pages/Goals.jsx';
import Landing from './pages/Landing.jsx';
import Log from './pages/Log.jsx';
import Milestones from './pages/Milestones.jsx';
import Plan from './pages/Plan.jsx';
import Weekly from './pages/Weekly.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [theme, toggleTheme] = useTheme();

  if (loading) return <div className="boot" aria-label="Loading" />;
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage key="login" initialMode="login" />} />
        <Route path="/register" element={<AuthPage key="register" initialMode="register" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
        <Route index element={<Dashboard />} />
        <Route path="log" element={<Log />} />
        <Route path="plan" element={<Plan />} />
        <Route path="goals" element={<Goals />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="milestones" element={<Milestones />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
