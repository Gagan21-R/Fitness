import mongoose from 'mongoose';
import { ACTIVITIES } from '../constants.js';

// A session the user intends to do. Whether it happened is worked out from the log,
// so nothing has to be ticked off by hand.
const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    activity: { type: String, enum: ACTIVITIES, required: true },
    durationMin: { type: Number, min: 5, max: 600 },
    note: { type: String, trim: true, maxlength: 120, default: '' },
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

planSchema.index({ user: 1, date: 1 });

export const Plan = mongoose.model('Plan', planSchema);
