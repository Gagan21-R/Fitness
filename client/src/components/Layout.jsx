import { createContext, useCallback, useContext, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarCheck, CalendarRange, History, LayoutDashboard, LogOut, Medal, Moon, Plus, Sun, Target, Timer } from 'lucide-react';
import { useAuth } from '../lib/context.jsx';
import { ConfirmModal } from './ui.jsx';
import { StartTimerModal, TimerPill, elapsedMs, useWorkoutTimer } from './Timer.jsx';
import WorkoutModal from './WorkoutModal.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, end: true },
  { to: '/log', label: 'Workout log', short: 'Log', icon: History },
  { to: '/plan', label: 'Weekly plan', short: 'Plan', icon: CalendarCheck },
  { to: '/goals', label: 'Goals', short: 'Goals', icon: Target },
  { to: '/weekly', label: 'Weekly summary', short: 'Week', icon: CalendarRange },
  { to: '/milestones', label: 'Milestones', short: 'Medals', icon: Medal },
];

const WorkoutModalContext = createContext(() => {});
/** Opens the workout form from anywhere: `open()`, `open({ workout })` to edit, `open({ repeat })`. */
export const useWorkoutModal = () => useContext(WorkoutModalContext);

const TimerContext = createContext({ timer: null, openStart: () => {} });
/** The live workout timer: `{ timer, openStart }`. */
export const useTimer = () => useContext(TimerContext);

export function Logo() {
  return (
    <span className="logo">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--line-strong)" strokeWidth="5" />
        <path d="M16 5a11 11 0 1 1-10.4 14.6" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span>
        Fitness<b>Consistency</b>
      </span>
    </span>
  );
}

const TICKER = ['Show up', 'Score it', 'Repeat', 'Your targets only', 'No leaderboards', 'Every week counts'];

/** Decorative scrolling strip above every page. */
function Ticker() {
  const row = TICKER.map((t) => (
    <span key={t}>
      {t}
      <i>✺</i>
    </span>
  ));
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {row}
        {row.map((el) => ({ ...el, key: `${el.key}-2` }))}
      </div>
    </div>
  );
}

export default function Layout({ theme, onToggleTheme }) {
  const { user, signOut } = useAuth();
  const [modal, setModal] = useState(null);
  const open = useCallback((options = {}) => setModal(options), []);
  const { timer, start, pause, resume, clear } = useWorkoutTimer();
  const [starting, setStarting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const openStart = useCallback(() => setStarting(true), []);

  function stopAndLog() {
    pause();
    open({
      repeat: { activity: timer.activity, durationMin: Math.max(1, Math.round(elapsedMs(timer) / 60000)) },
      fromTimer: true,
      onSaved: clear,
    });
  }

  const timerButton = (className) => (
    <button
      type="button"
      className={className}
      onClick={openStart}
      disabled={Boolean(timer)}
      aria-label="Start workout timer"
      title={timer ? 'A timer is already running' : 'Start workout timer'}
    >
      <Timer size={18} aria-hidden="true" />
      {className.startsWith('btn ') && ' Start timer'}
    </button>
  );

  return (
    <WorkoutModalContext.Provider value={open}>
      <TimerContext.Provider value={{ timer, openStart }}>
      <div className="shell">
        <aside className="sidebar">
          <Logo />
          <button type="button" className="btn btn-primary btn-block" onClick={() => open()}>
            <Plus size={18} aria-hidden="true" /> Log workout
          </button>
          {timerButton('btn btn-ghost btn-block sidebar-timer')}
          <nav aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                <Icon size={19} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="user-name">{user.name}</span>
            </div>
            <div className="sidebar-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={onToggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        <header className="topbar">
          <Logo />
          <div className="sidebar-actions">
            {timerButton('icon-btn')}
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="main-col">
          <Ticker />
          <main className="main">
            <Outlet />
          </main>
        </div>

        <button type="button" className="fab" onClick={() => open()} aria-label="Log workout">
          <Plus size={26} aria-hidden="true" />
        </button>

        <nav className="tabbar" aria-label="Main">
          {NAV.map(({ to, short, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="tab-link">
              <Icon size={20} aria-hidden="true" />
              <span>{short}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      {timer && (
        <TimerPill
          timer={timer}
          onPause={pause}
          onResume={resume}
          onStop={stopAndLog}
          onDiscard={() => setDiscarding(true)}
        />
      )}
      {starting && (
        <StartTimerModal
          onClose={() => setStarting(false)}
          onStart={(activity) => {
            start(activity);
            setStarting(false);
          }}
        />
      )}
      {discarding && (
        <ConfirmModal
          title="Discard this timer?"
          body="The time so far won't be logged."
          confirmLabel="Discard timer"
          onConfirm={() => {
            clear();
            setDiscarding(false);
          }}
          onClose={() => setDiscarding(false)}
        />
      )}
      {modal && <WorkoutModal {...modal} onClose={() => setModal(null)} />}
      </TimerContext.Provider>
    </WorkoutModalContext.Provider>
  );
}
