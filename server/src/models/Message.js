import mongoose from 'mongoose';
import { CONTACT_TOPICS } from '../constants.js';

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, lowercase: true, trim: true },
    topic: { type: String, enum: CONTACT_TOPICS, required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Message = mongoose.model('Message', messageSchema);
