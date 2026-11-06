# FitnessConsistency

A personal exercise consistency tracker. Log workouts by hand, set weekly targets, and see how consistent you are across every activity type. Your score compares you only with your own targets, and nothing ranks you against other users.

**Stack:** React, Node.js + Express REST API, MongoDB

**Student:** Gagan R (2102508569)

## Run it

Needs Node.js 20 or newer. MongoDB does not need installing, because the server starts its own copy if `MONGO_URI` is empty. The first run downloads that copy (about 65 MB), so it needs internet and can take a few minutes.

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. Signed-out visitors see the landing page; choose **Explore 6 months of demo data**, or create an account.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API (port 5000) and the React dev server (port 5173) |
| `npm test` | Runs the 37 API and statistics tests |
| `npm run build` | Builds the React app into `client/dist` |
| `npm start` | Serves the API and the built app together on port 5000. Set `JWT_SECRET` first |
| `npm run seed` | Rebuilds the demo account. Stop the dev server first |

To use your own MongoDB or Atlas, copy `server/.env.example` to `server/.env` and set `MONGO_URI`.

The built-in database keeps its data in `~/.fitness-consistency`, outside the project folder, because Windows can't start MongoDB from a deeply nested folder.

## How the brief is met

| Requirement | Where it is |
| --- | --- |
| Manual workout log | Log form with add, edit and delete: activity, date, duration, intensity, distance, notes |
| Goals | Weekly targets by activity, measured in sessions, minutes or active days |
| Weekly summaries | Week-by-week page with totals, target results and a written summary |
| Consistency across activity types | Activity balance, 6-month heatmap, 12-week trend |
| Compare with personal targets, no ranking | The score uses only your own targets. There are no leaderboards |
| React UI | `client/` |
| Node.js + Express REST API | `server/src/routes/` |
| MongoDB persistence | Mongoose models in `server/src/models/` |
| Input validation | Zod schemas on the server (`validation.js`), plus inline checks in each form |
| Error handling | One error format from the API, plus loading, empty, error and retry states in the UI |
| Responsive design | Sidebar on desktop, bottom tabs and a quick-add button on phones |

## Added features

- **Live workout timer:** start a session with one tap. The timer survives a page refresh, and stopping it opens the log form with the time filled in
- **Weekly planner:** plan sessions for each day. They tick themselves off when you log a matching workout, and "Copy last week" repeats a plan without duplicates
- **Ghost race:** this week's minutes, day by day, against your own 4-week average, because the only rival is your usual self
- **Personal records:** longest session, longest distance per activity, fastest running pace and biggest week, with confetti when you beat one
- **How workouts make you feel:** rate each session from Drained to Buzzing, then see which activity lifts you most

- **Landing page:** a maximalist showcase with motion effects, crossing marquees, a rotating stamp, case studies of the main features, a team section and a contact form that saves to MongoDB

- **Consistency score:** 0 to 100 each week, against your own targets
- **Pace tracking:** mid-week, each target shows On pace, Behind pace or Reached
- **Streaks:** consecutive active days, and consecutive weeks with every target reached
- **Insights:** generated from your log, such as your most reliable day or an activity that has dropped off
- **Milestones:** 12 personal achievements with progress bars
- **Workout log tools:** search, filters, sorting, pagination, "log again today" and CSV export
- **Goal history:** changing a target applies from that week on, so past results stay as they were
- **Accounts:** sign-up and login with JWT and bcrypt, and each user sees only their own data
- **Demo mode:** one click opens 6 months of sample data, useful for presentations
- **Interface:** a maximalist design (bold colour blocks, patterns, thick outlines, hard shadows, mixed typefaces) in light and dark themes, animated charts, confetti when you reach a target, printable weekly reports

## How the score works

For each target active that week:

```
completion = min(100, actual / target × 100)
```

The week's score is the average completion of its targets. The cap at 100 is deliberate: overachieving on one target can't hide missing another. For example, 4 runs against a target of 2 (100) and no yoga against a target of 1 (0) gives a score of 50.

## Architecture

```
React (Vite, React Query, Recharts)
        │  JSON over HTTP, JWT bearer token
Express API
  helmet, CORS, rate limit → routes → Zod validation → error handler
        │
  services/stats.js (pure calculations, unit tested)
        │  Mongoose
MongoDB: users, workouts, goals
```

Three design decisions worth explaining:

- **Dates are stored as `YYYY-MM-DD` text.** A workout belongs to the calendar day it was logged on, so it can't move to another day across timezones. This text also sorts in date order.
- **Goals keep a history of their targets.** Each target value records the week it started, so raising a goal today doesn't turn last month's hits into misses.
- **Statistics are pure functions.** They take plain data and touch no database, which makes the rules easy to test.

## REST API

All routes start with `/api`. Everything except sign-up, login, demo, contact and health needs an `Authorization: Bearer <token>` header.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Server and database status |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Sign in |
| POST | `/auth/demo` | Open the demo account |
| GET | `/auth/me` | Current user |
| POST | `/contact` | Send a contact message. Saved to MongoDB, no sign-in needed |
| GET | `/workouts` | List, with `page`, `limit`, `activity`, `from`, `to`, `q`, `sort` |
| POST | `/workouts` | Log a workout. Also returns any goals it completed and records it broke |
| GET, PUT, DELETE | `/workouts/:id` | Read, update or delete one workout |
| GET | `/workouts/export.csv` | Download as CSV, with the same filters |
| GET, POST | `/goals` | List or create goals |
| PATCH, DELETE | `/goals/:id` | Change the name or target, retire, or delete |
| GET | `/stats/dashboard` | Everything the dashboard shows |
| GET | `/stats/week?week=` | One week's summary |
| GET | `/stats/achievements` | Milestones and progress |
| GET | `/stats/records` | Personal records and post-workout feelings |
| GET, POST | `/plans` | A week's planned sessions, with done, missed or planned status, or add one |
| POST | `/plans/copy` | Copy one week's plan into another, skipping sessions already there |
| DELETE | `/plans/:id` | Remove a planned session |

Errors always have this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "durationMin": "..." } } }
```

## Security

- Passwords are hashed with bcrypt and never returned by the API
- Login gives the same error for an unknown email and a wrong password
- Every workout and goal query is limited to the signed-in user
- Zod rejects non-text login values, which blocks NoSQL operator injection
- Sign-in routes are rate limited, and helmet sets the security headers
- CSV export neutralises spreadsheet formulas in notes

## Project layout

```
server/src/
  routes/       auth, contact, workouts, plans, goals, stats
  models/       User, Workout, Goal, Plan, Message
  services/     stats.js (score, streaks, insights, milestones)
  middleware/   auth, errors
  seed/         demo data
  validation.js Zod schemas
server/test/    API and statistics tests
client/src/
  pages/        Landing, Auth, Dashboard, Log, Plan, Goals, Weekly, Milestones
  components/   Layout, WorkoutModal, Timer, Charts, ui
  lib/          api client, auth, theme, toasts, formatting
```
