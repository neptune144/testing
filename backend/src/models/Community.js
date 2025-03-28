import mongoose from 'mongoose';

const webinarSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Webinar name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Webinar description is required'],
    trim: true
  },
  meetingLink: {
    type: String,
    required: [true, 'Meeting link is required'],
    trim: true
  },
  scheduledFor: {
    type: Date,
    required: [true, 'Webinar schedule is required']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String,
    url: String,
    mimetype: String
  }],
  projectProgress: {
    completionPercentage: Number,
    lastUpdated: Date,
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const communitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  webinars: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Webinar'
  }],
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better query performance
communitySchema.index({ name: 1 });
communitySchema.index({ 'members.user': 1 });
communitySchema.index({ creator: 1 });

// Virtual for member count
communitySchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Virtual for webinar count
communitySchema.virtual('webinarCount').get(function() {
  return this.webinars.length;
});

// Method to check if a user is an admin
communitySchema.methods.isAdmin = function(userId) {
  return this.admins.some(adminId => adminId.toString() === userId.toString());
};

// Method to check if a user is a member
communitySchema.methods.isMember = function(userId) {
  return this.members.some(memberId => memberId.toString() === userId.toString());
};

// Method to add a member
communitySchema.methods.addMember = async function(userId, role = 'member') {
  if (!this.isMember(userId)) {
    this.members.push({
      user: userId,
      role: role
    });
    await this.save();
  }
};

// Method to remove a member
communitySchema.methods.removeMember = async function(userId) {
  this.members = this.members.filter(member => member.user.toString() !== userId.toString());
  await this.save();
};

// Ensure virtuals are included when converting to JSON
communitySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Community = mongoose.model('Community', communitySchema);

export default Community; 