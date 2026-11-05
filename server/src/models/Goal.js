import mongoose from 'mongoose';
import { ACTIVITIES, METRICS } from '../constants.js';

// A goal is a weekly personal target. Its target can change over time, so `targets` records
// each value with the week it took effect: raising a goal today must not turn last month's
// hits into misses. `archivedFromWeek` retires a goal while keeping its past weeks in the score.
const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    activity: { type: String, enum: ['all', ...ACTIVITIES], required: true, default: 'all' },
    metric: { type: String, enum: METRICS, required: true },
    startWeek: { type: String, required: true },
    archivedFromWeek: { type: String, default: null },
    targets: {
      type: [
        {
          _id: false,
          week: { type: String, required: true },
          value: { type: Number, required: true, min: 1 },
        },
      ],
      validate: (v) => v.length > 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.user;
        ret.target = ret.targets[ret.targets.length - 1].value;
        return ret;
      },
    },
  },
);

export const Goal = mongoose.model('Goal', goalSchema);
