import mongoose from 'mongoose';

const RequestSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectTitle: { type: String, required: true },
  description: { type: String, default: '' },
  budget: { type: Number, default: 0 },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'closed'], default: 'pending' },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

const Request = mongoose.model('Request', RequestSchema);
export default Request;
