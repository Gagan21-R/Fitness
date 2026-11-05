import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Link2, ShieldCheck, Target, Waypoints } from 'lucide-react';
import { motion } from 'framer-motion';
import { Logo } from '../components/Layout.jsx';
import { Field, ProgressRing } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/context.jsx';
import { showcaseCells } from '../lib/showcase.js';

const POINTS = [
  { icon: Target, title: 'Your targets, your score', body: 'Measured against the goals you set. No leaderboards, ever.' },
  { icon: Waypoints, title: 'Every activity, one picture', body: 'Runs, lifts and yoga add up to one view of your week.' },
  { icon: Link2, title: 'Weeks that connect', body: 'Streaks and trends show the pattern a single workout hides.' },
];

const HERO_CELLS = showcaseCells();

export default function AuthPage({ initialMode = 'login' }) {
  const { accept } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const isRegister = mode === 'register';
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const found = {};
    if (isRegister && form.name.trim().length < 2) found.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Enter a valid email';
    if (isRegister && form.password.length < 8) found.password = 'Password must be at least 8 characters';
    if (!isRegister && !form.password) found.password = 'Password is required';
    return found;
  }

  async function run(kind, request) {
    setBusy(kind);
    setErrors({});
    try {
      accept(await request());
    } catch (err) {
      const hasFields = Object.keys(err.fields).length > 0;
      setErrors({ ...err.fields, form: hasFields ? undefined : err.message });
      setBusy(null);
    }
  }

  function submit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    run(
      'form',
      () => (isRegister ? api.post('/auth/register', form) : api.post('/auth/login', { email: form.email, password: form.password })),
    );
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-top">
          <Logo />
          <Link to="/" className="link auth-back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to home
          </Link>
        </div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          Showing up is the <em>whole</em> workout.
        </motion.h1>
        <p className="auth-lead">
          Log your training by hand, set weekly targets, and see how consistent you really are, across every activity
          you do.
        </p>
        <div className="auth-visual" aria-hidden="true">
          <ProgressRing value={86} size={148} stroke={13} sublabel="this week" />
          <div className="hero-grid">
            {HERO_CELLS.map((l, i) => (
              <i key={i} className={`heat-cell heat-${l}`} />
            ))}
          </div>
        </div>
        <ul className="auth-points">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon size={20} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="muted-2">{isRegister ? 'It takes under a minute.' : 'Sign in to see your week.'}</p>

          <form onSubmit={submit} noValidate className="form">
            {isRegister && (
              <Field label="Name" htmlFor="a-name" error={errors.name}>
                <input id="a-name" autoComplete="name" value={form.name} onChange={set('name')} />
              </Field>
            )}
            <Field label="Email" htmlFor="a-email" error={errors.email}>
              <input id="a-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
            </Field>
            <Field
              label="Password"
              htmlFor="a-password"
              error={errors.password}
              hint={isRegister ? 'At least 8 characters' : undefined}
            >
              <input
                id="a-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={set('password')}
              />
            </Field>
            {errors.form && (
              <p className="form-error" role="alert">
                {errors.form}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={Boolean(busy)}>
              {busy === 'form' ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-or">
            <span>or</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            disabled={Boolean(busy)}
            onClick={() => run('demo', () => api.post('/auth/demo'))}
          >
            {busy === 'demo' ? 'Opening demo…' : 'Explore with 6 months of demo data'}
          </button>

          <p className="auth-switch muted-2">
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setErrors({});
              }}
            >
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-note small muted">
            <ShieldCheck size={14} aria-hidden="true" /> Passwords are stored as salted bcrypt hashes.
          </p>
        </div>
      </section>
    </div>
  );
}
