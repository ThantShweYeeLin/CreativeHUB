import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: { type: [String], default: [] },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() }
});

const Message = mongoose.model('Message', MessageSchema);
export default Message;
