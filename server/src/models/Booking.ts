import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceTitle: { type: String, required: true },
  serviceDescription: { type: String, default: '' },
  date: { type: Date, required: true },
  time: { type: String, default: '' },
  location: { type: String, default: '' },
  budget: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

const Booking = mongoose.model('Booking', BookingSchema);
export default Booking;
