import mongoose from 'mongoose';

const PortfolioItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  projectUrl: { type: String, default: '' },
  createdAt: { type: Date, default: () => new Date() }
});

const ReviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 0, max: 5, required: true },
  comment: { type: String, default: '' },
  createdAt: { type: Date, default: () => new Date() }
});

const FreelancerProfileSchema = new mongoose.Schema({
  specialty: { type: String, default: '' },
  hourlyRate: { type: Number, default: 0 },
  languages: { type: [String], default: [] },
  skills: { type: [String], default: [] },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  portfolio: { type: [PortfolioItemSchema], default: [] },
  rating: { type: Number, default: 0 },
  reviews: { type: [ReviewSchema], default: [] },
  depositAmount: { type: Number, default: 0 },
  availability: { type: [String], default: [] }
});

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['client', 'freelancer'], default: 'client' },
  avatarUrl: { type: String, default: '' },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  favorites: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  notificationTokens: { type: [String], default: [] },
  freelancerProfile: { type: FreelancerProfileSchema, default: () => ({}) },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

const User = mongoose.model('User', UserSchema);
export default User;
