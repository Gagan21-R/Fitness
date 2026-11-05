import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, Download, History, Pencil, Search, Trash2 } from 'lucide-react';
import { useWorkoutModal } from '../components/Layout.jsx';
import { ActivityIcon, ConfirmModal, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui.jsx';
import { ACTIVITIES, INTENSITIES, activityInfo } from '../lib/activities.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/context.jsx';
import { minutes, plural, relativeDay } from '../lib/format.js';

const EMPTY = { activity: '', from: '', to: '', q: '', sort: 'newest' };

function Intensity({ value }) {
  return (
    <span className="intensity" aria-label={`Intensity: ${INTENSITIES[value - 1]}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= value ? 'on' : ''} />
      ))}
    </span>
  );
}

export default function Log() {
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const open = useWorkoutModal();
  const toast = useToast();
  const queryClient = useQueryClient();

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
      setPage((p) => (filters.q === search ? p : 1));
    }, 300);
    return () => clearTimeout(id);
  }, [search, filters.q]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['workouts', filters, page],
    queryFn: () => api.get('/workouts', { ...filters, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/workouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast('Workout deleted', 'success');
      setToDelete(null);
    },
    onError: (err) => {
      toast(err.message, 'error');
      setToDelete(null);
    },
  });

  const filtered = filters.activity || filters.from || filters.to || filters.q;

  async function exportCsv() {
    try {
      await api.download('/workouts/export.csv', filters, 'fitness-consistency-workouts.csv');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title="Workout log"
        subtitle={data ? `${plural(data.total, 'workout')}, ${minutes(data.totalMinutes)} in total` : ' '}
        actions={
          <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!data?.total}>
            <Download size={16} aria-hidden="true" /> Export CSV
          </button>
        }
      />

      <div className="filters card">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search notes</span>
          <input type="search" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Activity</span>
          <select value={filters.activity} onChange={(e) => setFilter('activity', e.target.value)}>
            <option value="">All activities</option>
            {ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="date-filter">
          <span className="small muted">From</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="date-filter">
          <span className="small muted">To</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest first</option>
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setFilters(EMPTY);
              setSearch('');
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <Skeleton height={420} />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {data && data.total === 0 && (
        <EmptyState
          icon={History}
          title={filtered ? 'No workouts match these filters' : 'Your log is empty'}
          body={filtered ? 'Try a wider date range or clear the filters.' : 'Log your first session and it will appear here.'}
          action={
            !filtered && (
              <button type="button" className="btn btn-primary" onClick={() => open()}>
                Log workout
              </button>
            )
          }
        />
      )}

      {data && data.total > 0 && (
        <>
          <ul className="log-list card" style={{ opacity: isFetching ? 0.75 : 1 }}>
            {data.items.map((w) => (
              <li key={w.id} className="log-row">
                <ActivityIcon activity={w.activity} size={20} />
                <div className="log-main">
                  <div className="log-title">
                    <strong>{activityInfo(w.activity).label}</strong>
                    <Intensity value={w.intensity} />
                  </div>
                  <span className="muted small">{relativeDay(w.date)}</span>
                  {w.notes && <p className="log-notes small muted-2">{w.notes}</p>}
                </div>
                <div className="log-figures tabular">
                  <strong>{minutes(w.durationMin)}</strong>
                  {w.distanceKm ? <span className="muted small">{w.distanceKm} km</span> : null}
                </div>
                <div className="log-actions">
                  <button type="button" className="icon-btn" aria-label="Log this again today" title="Log again today" onClick={() => open({ repeat: w })}>
                    <Copy size={16} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Edit workout" title="Edit" onClick={() => open({ workout: w })}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Delete workout" title="Delete" onClick={() => setToDelete(w)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} aria-hidden="true" /> Newer
              </button>
              <span className="muted-2 small tabular">
                Page {data.page} of {data.pages}
              </span>
              <button type="button" className="btn btn-ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                Older <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {toDelete && (
        <ConfirmModal
          title="Delete this workout?"
          body={`${activityInfo(toDelete.activity).label} on ${relativeDay(toDelete.date)}, ${minutes(toDelete.durationMin)}. This also updates that week's score, and it can't be undone.`}
          confirmLabel="Delete workout"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
