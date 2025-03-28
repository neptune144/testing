import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    trim: true
  },
  attachments: [{
    url: String,
    filename: String,
    mimetype: String
  }],
  projectProgress: {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    deadline: Date,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
}); 

const Message = mongoose.model('Message', messageSchema);

export default Message; 