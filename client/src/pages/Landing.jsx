import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Flame,
  KeyRound,
  LineChart,
  Mail,
  Menu,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { Field, Modal, ProgressRing } from '../components/ui.jsx';
import { ACTIVITIES } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/context.jsx';
import { showcaseCells } from '../lib/showcase.js';
import '../landing.css';

const EASE = [0.22, 1, 0.36, 1];
const CELLS = showcaseCells(18);

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: EASE },
};

/* ---------- Small motion pieces ---------- */

function Magnetic({ children, className, strength = 0.3, ...props }) {
  const ref = useRef(null);
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  const Tag = props.to ? motion(Link) : props.href ? motion.a : motion.button;
  return (
    <Tag
      ref={ref}
      className={className}
      style={{ x, y }}
      onPointerMove={(e) => {
        const box = ref.current.getBoundingClientRect();
        x.set((e.clientX - box.left - box.width / 2) * strength);
        y.set((e.clientY - box.top - box.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}

function SplitWords({ text, delay = 0, className }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((word, i) => (
        <span className="word-mask" key={`${word}-${i}`} aria-hidden="true">
          <motion.span
            className="word"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: delay + i * 0.08, ease: EASE }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function CountUp({ to, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!inView || reduced) return undefined;
    const controls = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, reduced]);
  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

function TiltCard({ children, className, onClick }) {
  const rx = useSpring(0, { stiffness: 150, damping: 18 });
  const ry = useSpring(0, { stiffness: 150, damping: 18 });
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (reduced) return;
        const box = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - box.left) / box.width - 0.5) * 10);
        rx.set(-((e.clientY - box.top) / box.height - 0.5) * 10);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      onClick={onClick}
      {...reveal}
    >
      {children}
    </motion.article>
  );
}

/* ---------- Content ---------- */

const CASES = [
  {
    id: '01',
    title: 'The weekly score',
    tag: 'Scoring engine',
    stack: ['Express', 'Pure functions', 'node:test'],
    visual: 'ring',
    challenge:
      'A single great workout feels productive, but it says nothing about whether the week held together.',
    approach:
      'Every weekly target is scored as min(100, actual ÷ target), then averaged. Mid-week, each target also reports whether you are on pace or behind.',
    result:
      'One honest number from 0 to 100. Overachieving on runs can never hide a skipped yoga session.',
  },
  {
    id: '02',
    title: 'Six months, one grid',
    tag: 'Data visualisation',
    stack: ['React', 'CSS Grid', 'Accessible tooltips'],
    visual: 'heatmap',
    challenge: 'Gaps in training are invisible in a list of workouts. You only notice them weeks later.',
    approach:
      'A 182-day heatmap shades each day by minutes trained, in five steps. Hover any day for details, or select it to open that whole week.',
    result: 'Patterns like an exam-week slump show up at a glance, long before they become habits.',
  },
  {
    id: '03',
    title: 'Targets that remember',
    tag: 'Data modelling',
    stack: ['MongoDB', 'Mongoose', 'Goal history'],
    visual: 'history',
    challenge: 'Raising a goal from 3 to 4 days should not turn last month’s hits into misses.',
    approach:
      'Each target value is stored with the week it took effect. Retiring a goal stops it from that week on, and its past weeks keep counting.',
    result: 'Your history stays fair, so you can raise the bar without rewriting the past.',
  },
  {
    id: '04',
    title: 'Balance across activities',
    tag: 'Insight engine',
    stack: ['Aggregation', 'Rule-based insights'],
    visual: 'balance',
    challenge: 'People drift into one favourite activity and quietly drop the rest.',
    approach:
      'A 28-day activity share, detection of activities that have dropped off, and plain-language insights such as your most reliable day.',
    result: 'The app shows what is missing from your training, not just what is there.',
  },
];

const PROCESS = [
  { step: 'Log', body: 'Record any session in seconds: activity, duration, intensity, distance and notes.' },
  { step: 'Target', body: 'Set weekly goals in sessions, minutes or active days, for one activity or all of them.' },
  { step: 'Review', body: 'Your score, streaks, heatmap and weekly summary show how the week really went.' },
  { step: 'Adjust', body: 'Raise or retire a target. Past weeks keep the target they were judged against.' },
];

const CREW = [
  { name: 'React', role: 'The Face', icon: MonitorSmartphone, body: 'Every screen, animation and form, with React Query keeping data fresh.' },
  { name: 'Express', role: 'The Messenger', icon: Workflow, body: 'A REST API with one consistent error format for every failure.' },
  { name: 'MongoDB', role: 'The Memory', icon: Database, body: 'Users, workouts, goals and messages, persisted through Mongoose models.' },
  { name: 'Zod', role: 'The Gatekeeper', icon: ShieldCheck, body: 'Validates every request, and blocks NoSQL operator injection.' },
  { name: 'JWT + bcrypt', role: 'The Bouncer', icon: KeyRound, body: 'Signed sessions and salted password hashes, plus rate limits on sign-in.' },
  { name: 'Recharts', role: 'The Storyteller', icon: LineChart, body: 'Trend lines and daily bars with tooltips and screen-reader tables.' },
];

const TOPICS = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'feature', label: 'Feature idea' },
  { id: 'bug', label: 'Bug report' },
  { id: 'collaboration', label: 'Collaboration' },
];

/* ---------- Visuals ---------- */

function MiniHeatmap({ weeks = 18 }) {
  return (
    <div className="lp-heat" aria-hidden="true">
      {CELLS.slice(-weeks * 7).map((l, i) => (
        <i key={i} className={`heat-cell heat-${l}`} />
      ))}
    </div>
  );
}

function CaseVisual({ kind }) {
  if (kind === 'ring') return <ProgressRing value={86} size={130} stroke={12} sublabel="this week" />;
  if (kind === 'heatmap') return <MiniHeatmap weeks={12} />;
  if (kind === 'history') {
    const hist = ['met', 'met', 'missed', 'met', 'met', 'met', 'missed', 'met'];
    return (
      <div className="lp-history" aria-hidden="true">
        <div className="lp-history-labels">
          <span>target 3</span>
          <span>target 4</span>
        </div>
        <div className="history">
          {hist.map((h, i) => (
            <span key={i} className={`history-cell history-${h}`} />
          ))}
        </div>
      </div>
    );
  }
  const rows = [
    ['Running', 40],
    ['Strength', 30],
    ['Yoga', 18],
    ['Cycling', 12],
  ];
  return (
    <div className="lp-balance" aria-hidden="true">
      {rows.map(([label, pct]) => (
        <div key={label}>
          <span>{label}</span>
          <div className="lp-balance-track">
            <motion.div
              className="hbar-fill"
              initial={{ width: 0 }}
              whileInView={{ width: `${pct * 2.2}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stamp() {
  const text = 'NO LEADERBOARDS ✺ 100% YOU ✺ EVERY WEEK COUNTS ✺ ';
  return (
    <div className="lp-stamp" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <defs>
          <path id="stamp-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text>
          <textPath href="#stamp-circle">{text}</textPath>
        </text>
      </svg>
      <span>✺</span>
    </div>
  );
}

function HeroScene() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const layer = (depth) => ({
    x: useTransform(sx, (v) => v * depth),
    y: useTransform(sy, (v) => v * depth),
  });
  const ring = layer(26);
  const toast = layer(-34);
  const streak = layer(18);
  const heat = layer(-14);

  useEffect(() => {
    const move = (e) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [mx, my]);

  const pop = (delay) => ({
    initial: { opacity: 0, scale: 0.85, y: 30 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <div className="lp-scene" aria-hidden="true">
      <motion.div className="glass lp-float lp-float-ring" style={ring} {...pop(0.5)}>
        <ProgressRing value={86} size={150} stroke={13} sublabel="of 100" />
        <span className="lp-float-caption">Consistency this week</span>
      </motion.div>
      <motion.div className="glass lp-float lp-float-toast" style={toast} {...pop(0.75)}>
        <CheckCircle2 size={18} />
        <div>
          <strong>Target reached</strong>
          <span>Run twice a week</span>
        </div>
      </motion.div>
      <motion.div className="glass lp-float lp-float-streak" style={streak} {...pop(0.95)}>
        <Flame size={18} />
        <div>
          <strong>6 weeks</strong>
          <span>every target hit</span>
        </div>
      </motion.div>
      <motion.div className="glass lp-float lp-float-heat" style={heat} {...pop(1.1)}>
        <MiniHeatmap weeks={14} />
      </motion.div>
      <Stamp />
    </div>
  );
}

/* ---------- Sections ---------- */

function Nav({ onDemo, busy }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = [
    ['#work', 'Work'],
    ['#process', 'Process'],
    ['#team', 'Team'],
    ['#contact', 'Contact'],
  ];
  return (
    <header className={`lp-nav glass ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <a href="#top" className="lp-nav-logo" aria-label="FitnessConsistency, back to top">
        <Logo />
      </a>
      <nav className="lp-nav-links" aria-label="Sections">
        {links.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
      <div className="lp-nav-actions">
        <Link to="/login" className="lp-nav-signin">
          Sign in
        </Link>
        <button type="button" className="btn btn-primary lp-nav-demo" onClick={onDemo} disabled={busy}>
          {busy ? 'Opening…' : 'Try the demo'}
        </button>
        <button
          type="button"
          className="icon-btn lp-nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}

function Hero({ onDemo, busy }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const fade = useTransform(scrollY, [0, 500], [1, 0.2]);
  return (
    <section className="lp-hero" id="top">
      <motion.div className="lp-hero-copy" style={{ y, opacity: fade }}>
        <motion.p
          className="lp-kicker"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Sparkles size={14} aria-hidden="true" /> Personal exercise consistency tracker · CIA project
        </motion.p>
        <h1 className="lp-title">
          <SplitWords text="Show up." className="lp-line" />
          <SplitWords text="Score it." className="lp-line lp-outline" delay={0.2} />
          <SplitWords text="Repeat." className="lp-line lp-accent" delay={0.4} />
        </h1>
        <motion.p
          className="lp-lead"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          FitnessConsistency turns a manual workout log into a clear weekly picture. It measures you against the
          targets you set, never against anyone else.
        </motion.p>
        <motion.div
          className="lp-cta-row"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1 }}
        >
          <Magnetic className="lp-cta" onClick={onDemo} disabled={busy} type="button">
            {busy ? 'Opening the demo…' : 'Explore 6 months of demo data'} <ArrowUpRight size={18} aria-hidden="true" />
          </Magnetic>
          <Magnetic className="lp-cta-ghost glass" to="/register">
            Create an account
          </Magnetic>
        </motion.div>
      </motion.div>
      <HeroScene />
      <a href="#work" className="lp-scroll-cue" aria-label="Scroll to the work">
        <span />
      </a>
    </section>
  );
}

function Marquee({ variant = 'a', reverse = false }) {
  const items = [...ACTIVITIES.map((a) => a.label), 'No leaderboards', 'Your targets only'];
  const row = (hidden) => (
    <div className="lp-marquee-row" aria-hidden={hidden || undefined}>
      {items.map((label) => (
        <span key={label}>
          {label} <i>✦</i>
        </span>
      ))}
    </div>
  );
  return (
    <section className={`lp-marquee lp-marquee-${variant}`} aria-label="Supported activities">
      <div className={`lp-marquee-track ${reverse ? 'is-reverse' : ''}`}>
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: 0, label: 'leaderboards, by design' },
    { value: 10, label: 'activity types' },
    { value: 12, label: 'personal milestones' },
    { value: 28, label: 'automated tests passing' },
  ];
  return (
    <section className="lp-section lp-stats">
      <motion.p className="lp-manifesto" {...reveal}>
        Most fitness apps celebrate the <em>workout</em>. We built one that celebrates the <em>week</em>, because
        consistency is the part that actually changes you.
      </motion.p>
      <div className="lp-stat-grid">
        {stats.map((s, i) => (
          <motion.div key={s.label} className="glass lp-stat" {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
            <strong>
              <CountUp to={s.value} />
            </strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Work() {
  const [active, setActive] = useState(null);
  return (
    <section className="lp-section" id="work">
      <motion.header className="lp-section-head" {...reveal}>
        <span className="lp-eyebrow">Selected work</span>
        <h2>
          Four problems, <span className="lp-outline">four answers.</span>
        </h2>
        <p>Each feature started as a question about consistency. Open a case study to see how it was solved.</p>
      </motion.header>
      <div className="lp-cases">
        {CASES.map((c) => (
          <TiltCard key={c.id} className="glass lp-case" onClick={() => setActive(c)}>
            <div className="lp-case-top">
              <span className="lp-case-id">{c.id}</span>
              <span className="lp-case-tag">{c.tag}</span>
            </div>
            <div className="lp-case-visual">
              <CaseVisual kind={c.visual} />
            </div>
            <h3>{c.title}</h3>
            <p>{c.challenge}</p>
            <div className="lp-case-foot">
              <span className="lp-chips">
                {c.stack.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </span>
              <button type="button" className="lp-case-open" aria-label={`Open case study: ${c.title}`}>
                <ArrowUpRight size={18} />
              </button>
            </div>
          </TiltCard>
        ))}
      </div>
      {active && (
        <Modal title={`${active.id} · ${active.title}`} onClose={() => setActive(null)}>
          <div className="lp-case-detail">
            <div className="lp-case-detail-visual">
              <CaseVisual kind={active.visual} />
            </div>
            {[
              ['Challenge', active.challenge],
              ['Approach', active.approach],
              ['Result', active.result],
            ].map(([label, text]) => (
              <section key={label}>
                <h4>{label}</h4>
                <p>{text}</p>
              </section>
            ))}
            <span className="lp-chips">
              {active.stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </span>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Process() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <section className="lp-section" id="process">
      <motion.header className="lp-section-head" {...reveal}>
        <span className="lp-eyebrow">Process</span>
        <h2>
          A loop, <span className="lp-outline">not a ladder.</span>
        </h2>
      </motion.header>
      <ol className="lp-process" ref={ref}>
        <motion.span className="lp-process-line" style={{ scaleY }} aria-hidden="true" />
        {PROCESS.map((p, i) => (
          <motion.li key={p.step} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }}>
            <span className="lp-process-num">0{i + 1}</span>
            <div className="glass lp-process-card">
              <h3>{p.step}</h3>
              <p>{p.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function Team() {
  return (
    <section className="lp-section" id="team">
      <motion.header className="lp-section-head" {...reveal}>
        <span className="lp-eyebrow">Team</span>
        <h2>
          One maker, <span className="lp-outline">six specialists.</span>
        </h2>
        <p>Designed and built as a college CIA project, with a carefully chosen stack doing the heavy lifting.</p>
      </motion.header>
      <div className="lp-team">
        <motion.article className="glass lp-maker" {...reveal}>
          <div className="lp-maker-avatar" aria-hidden="true">
            GR
          </div>
          <div>
            <span className="lp-eyebrow">Developer</span>
            <h3>Gagan R</h3>
            <p>
              Designed and built FitnessConsistency end to end: the React interface, the Express API, the MongoDB data
              model and the test suite.
            </p>
            <span className="lp-chips">
              <span>Full stack</span>
              <span>UI design</span>
              <span>Testing</span>
            </span>
          </div>
        </motion.article>
        <div className="lp-crew">
          {CREW.map(({ name, role, icon: Icon, body }, i) => (
            <motion.article
              key={name}
              className="glass lp-crew-card"
              {...reveal}
              transition={{ ...reveal.transition, delay: (i % 3) * 0.08 }}
            >
              <span className="lp-crew-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="lp-crew-role">{role}</span>
              <h3>{name}</h3>
              <p>{body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'feedback', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Enter a valid email';
    if (form.message.trim().length < 10) found.message = 'Message must be at least 10 characters';
    setErrors(found);
    if (Object.keys(found).length) return;
    setState('sending');
    try {
      await api.post('/contact', form);
      setState('sent');
    } catch (err) {
      setErrors({ ...err.fields, form: Object.keys(err.fields).length ? undefined : err.message });
      setState('idle');
    }
  }

  return (
    <section className="lp-section lp-contact" id="contact">
      <motion.div className="lp-contact-copy" {...reveal}>
        <span className="lp-eyebrow">Contact</span>
        <h2>
          Got an idea? <span className="lp-accent">Say hello.</span>
        </h2>
        <p>
          Feedback, a feature you would like, a bug you found, or a project to work on together. Every message is
          stored safely and read.
        </p>
        <p className="lp-contact-note">
          <Mail size={16} aria-hidden="true" /> Messages are saved to the project database.
        </p>
      </motion.div>

      <motion.div className="glass lp-form-card" {...reveal}>
        {state === 'sent' ? (
          <motion.div
            className="lp-sent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            role="status"
          >
            <CheckCircle2 size={44} aria-hidden="true" />
            <h3>Message sent</h3>
            <p>Thanks, {form.name.split(' ')[0]}. It has been saved and will be read soon.</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setForm({ name: '', email: '', topic: 'feedback', message: '', website: '' });
                setState('idle');
              }}
            >
              Send another
            </button>
          </motion.div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <div className="form-row">
              <Field label="Name" htmlFor="c-name" error={errors.name}>
                <input id="c-name" autoComplete="name" value={form.name} onChange={set('name')} />
              </Field>
              <Field label="Email" htmlFor="c-email" error={errors.email}>
                <input id="c-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              </Field>
            </div>
            <fieldset className="field">
              <legend>Topic</legend>
              <div className="chips">
                {TOPICS.map((t) => (
                  <label key={t.id} className={`chip lp-topic ${form.topic === t.id ? 'is-selected' : ''}`}>
                    <input type="radio" name="topic" value={t.id} checked={form.topic === t.id} onChange={set('topic')} />
                    {t.label}
                  </label>
                ))}
              </div>
              {errors.topic && <span className="field-message">{errors.topic}</span>}
            </fieldset>
            <Field label="Message" htmlFor="c-message" error={errors.message} hint={`${form.message.length} of 2000`}>
              <textarea id="c-message" rows={4} maxLength={2000} value={form.message} onChange={set('message')} />
            </Field>
            <input
              className="lp-honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              name="website"
              value={form.website}
              onChange={set('website')}
            />
            {errors.form && (
              <p className="form-error" role="alert">
                {errors.form}
              </p>
            )}
            <Magnetic className="lp-cta lp-submit" type="submit" disabled={state === 'sending'} strength={0.15}>
              {state === 'sending' ? 'Sending…' : 'Send message'} <Send size={16} aria-hidden="true" />
            </Magnetic>
          </form>
        )}
      </motion.div>
    </section>
  );
}

function Footer({ onDemo, busy }) {
  return (
    <footer className="lp-footer">
      <motion.div className="lp-footer-cta" {...reveal}>
        <h2 className="lp-giant">
          Ready to <span className="lp-accent">show up?</span>
        </h2>
        <div className="lp-cta-row">
          <Magnetic className="lp-cta" onClick={onDemo} disabled={busy} type="button">
            Try the demo <ArrowRight size={18} aria-hidden="true" />
          </Magnetic>
          <Magnetic className="lp-cta-ghost glass" to="/register">
            Create an account
          </Magnetic>
        </div>
      </motion.div>
      <div className="lp-footer-bar">
        <Logo />
        <span>A CIA project by Gagan R · React, Express, MongoDB</span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}

/* ---------- Page ---------- */

export default function Landing() {
  const { accept } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const root = useRef(null);
  const { scrollYProgress } = useScroll();

  async function openDemo() {
    setBusy(true);
    setError(null);
    try {
      accept(await api.post('/auth/demo'));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // The background glow follows the pointer through CSS variables, so React doesn't re-render.
  useEffect(() => {
    const el = root.current;
    const move = (e) => {
      el.style.setProperty('--mx', `${e.clientX}px`);
      el.style.setProperty('--my', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing" ref={root}>
        <motion.div className="lp-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
        <div className="lp-bg" aria-hidden="true">
          <span className="lp-shape lp-shape-circle" />
          <span className="lp-shape lp-shape-star">✺</span>
          <span className="lp-shape lp-shape-ring" />
          <span className="lp-shape lp-shape-plus">✚</span>
          <span className="lp-spot" />
        </div>
        <Nav onDemo={openDemo} busy={busy} />
        {error && (
          <p className="lp-error glass" role="alert">
            {error}
          </p>
        )}
        <main>
          <Hero onDemo={openDemo} busy={busy} />
          <div className="lp-marquees">
            <Marquee />
            <Marquee variant="b" reverse />
          </div>
          <Stats />
          <Work />
          <Process />
          <Team />
          <Contact />
        </main>
        <Footer onDemo={openDemo} busy={busy} />
      </div>
    </MotionConfig>
  );
}
