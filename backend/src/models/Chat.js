import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  githubLink: {
    type: String,
    trim: true
  },
  attachments: [{
    type: {
      type: String,
      enum: ['file', 'image', 'code', 'module'],
      required: true
    },
    filename: String,
    path: String,
    mimetype: String,
    size: Number,
    language: String,
    preview: String,
    moduleData: {
      title: String,
      description: String,
      completionPercentage: Number,
      githubLink: String
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'project'],
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: function() {
      return this.type === 'project';
    },
    validate: {
      validator: function(v) {
        return this.type !== 'project' || v != null;
      },
      message: 'Project ID is required for project chats'
    }
  },
  messages: [messageSchema],
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: Date,
    hasAttachments: Boolean,
    githubLink: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ participants: 1, type: 1 });
chatSchema.index({ project: 1, type: 1 });

// Middleware to populate project details
chatSchema.pre('find', function(next) {
  if (this.getQuery().type === 'project') {
    this.populate('project', 'name description deadline');
  }
  next();
});

chatSchema.pre('findOne', function(next) {
  if (this.getQuery().type === 'project') {
    this.populate('project', 'name description deadline');
  }
  next();
});

// Method to get project ID safely
chatSchema.methods.getProjectId = function() {
  if (this.type !== 'project') return null;
  return this.project?._id || this.project;
};

// Method to add a message
chatSchema.methods.addMessage = async function(senderId, content, attachments = [], githubLink = null) {
  const message = {
    sender: senderId,
    content,
    attachments,
    githubLink: githubLink || null,
    readBy: [{ user: senderId }]
  };

  this.messages.push(message);
  this.lastMessage = {
    content,
    sender: senderId,
    createdAt: new Date(),
    hasAttachments: attachments.length > 0,
    githubLink: githubLink || null
  };

  await this.save();
  return this.messages[this.messages.length - 1];
};

// Method to mark messages as read
chatSchema.methods.markAsRead = async function(userId) {
  const unreadMessages = this.messages.filter(msg => 
    !msg.readBy.some(read => read.user.toString() === userId.toString())
  );

  unreadMessages.forEach(msg => {
    msg.readBy.push({ user: userId });
  });

  if (unreadMessages.length > 0) {
    await this.save();
  }

  return unreadMessages.length;
};

// Static method to get or create a direct chat
chatSchema.statics.getOrCreateDirectChat = async function(user1Id, user2Id) {
  let chat = await this.findOne({
    type: 'direct',
    participants: { 
      $all: [user1Id, user2Id],
      $size: 2 
    }
  });

  if (!chat) {
    chat = await this.create({
      type: 'direct',
      participants: [user1Id, user2Id]
    });
  }

  return chat;
};

const Chat = mongoose.model('Chat', chatSchema);
export default Chat; 