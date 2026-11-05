import {
  Activity,
  BatteryLow,
  Meh,
  Smile,
  SmilePlus,
  Zap,
  Bike,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  Music,
  PersonStanding,
  Trophy,
  Waves,
} from 'lucide-react';

// Activities are told apart by icon and name rather than colour: ten hues can't stay
// distinguishable, and the app's colour is reserved for progress.
export const ACTIVITIES = [
  { id: 'running', label: 'Running', icon: PersonStanding, distance: true },
  { id: 'walking', label: 'Walking', icon: Footprints, distance: true },
  { id: 'cycling', label: 'Cycling', icon: Bike, distance: true },
  { id: 'swimming', label: 'Swimming', icon: Waves, distance: true },
  { id: 'strength', label: 'Strength', icon: Dumbbell },
  { id: 'yoga', label: 'Yoga', icon: Flower2 },
  { id: 'hiit', label: 'HIIT', icon: Flame },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'dance', label: 'Dance', icon: Music },
  { id: 'other', label: 'Other', icon: Activity },
];

const byId = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));
export const activityInfo = (id) => byId[id] || { id, label: 'All activities', icon: Activity };

export const INTENSITIES = ['Easy', 'Light', 'Moderate', 'Hard', 'Max'];

export const METRICS = {
  activeDays: { label: 'Active days', unit: 'days', max: 7 },
  sessions: { label: 'Sessions', unit: 'sessions', max: 21 },
  minutes: { label: 'Minutes', unit: 'min', max: 3000 },
};

/** "1 session", "2 sessions", "150 min" */
export function metricAmount(metric, value) {
  const { unit } = METRICS[metric];
  return `${value} ${value === 1 && unit !== 'min' ? unit.slice(0, -1) : unit}`;
}

// How a session left you feeling, 1 to 5. Shown as icon + word, never colour alone.
export const FEELINGS = [
  { value: 1, label: 'Drained', icon: BatteryLow },
  { value: 2, label: 'Meh', icon: Meh },
  { value: 3, label: 'Okay', icon: Smile },
  { value: 4, label: 'Good', icon: SmilePlus },
  { value: 5, label: 'Buzzing', icon: Zap },
];

export const feelingLabel = (value) => FEELINGS.find((f) => f.value === Math.round(value))?.label ?? '';
