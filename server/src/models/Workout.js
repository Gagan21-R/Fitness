import mongoose from 'mongoose';
import { ACTIVITIES } from '../constants.js';

const workoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    activity: { type: String, enum: ACTIVITIES, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    durationMin: { type: Number, required: true, min: 1, max: 600 },
    intensity: { type: Number, required: true, min: 1, max: 5, default: 3 },
    distanceKm: { type: Number, min: 0, max: 1000 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    feeling: { type: Number, min: 1, max: 5 },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.user;
        return ret;
      },
    },
  },
);

workoutSchema.index({ user: 1, date: -1, createdAt: -1 });

export const Workout = mongoose.model('Workout', workoutSchema);
