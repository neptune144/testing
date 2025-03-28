import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Planning', 'In Progress', 'Completed', 'On Hold'],
    default: 'Planning'
  },
  deadline: {
    type: Date,
    required: [true, 'Project deadline is required']
  },
  moduleSubmissions: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    githubLink: {
      type: String,
      trim: true
    },
    files: [{
      filename: String,
      path: String,
      mimetype: String,
      size: Number,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    completionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  technologies: [{
    type: String,
    trim: true
  }],
  githubUrl: {
    type: String,
    trim: true
  },
  liveUrl: {
    type: String,
    trim: true
  },
  openings: [{
    role: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Open', 'Filled', 'Closed'],
      default: 'Open'
    },
    skills: [{
      type: String,
      trim: true
    }],
    applicants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Rejected'],
        default: 'Pending'
      },
      appliedAt: {
        type: Date,
        default: Date.now
      }
    }],
    filledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date
  }],
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Active', 'Inactive'],
      default: 'Pending'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tasks: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['Todo', 'In Progress', 'Review', 'Completed'],
      default: 'Todo'
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    dueDate: Date,
    createdAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date
  }],
  discussions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    attachments: [{
      name: String,
      url: String,
      type: String
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date,
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      message: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  isPrivate: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define the virtual property for progress
projectSchema.virtual('progressData').get(function() {
  if (!this.moduleSubmissions || this.moduleSubmissions.length === 0) {
    return {
      completionPercentage: 0,
      lastUpdated: new Date()
    };
  }
  
  const totalPercentage = this.moduleSubmissions.reduce((sum, submission) => {
    return sum + (submission.completionPercentage || 0);
  }, 0);
  
  const lastSubmission = this.moduleSubmissions
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    
  return {
    completionPercentage: Math.round(totalPercentage / this.moduleSubmissions.length),
    lastUpdated: lastSubmission.submittedAt
  };
});

// Add a method to update progress
projectSchema.methods.updateProgress = function() {
  if (!this.moduleSubmissions || this.moduleSubmissions.length === 0) {
    return 0;
  }
  
  const totalPercentage = this.moduleSubmissions.reduce((sum, submission) => {
    return sum + (submission.completionPercentage || 0);
  }, 0);
  
  return Math.round(totalPercentage / this.moduleSubmissions.length);
};

// Ensure virtuals are included when converting to JSON
projectSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Method to check if a user is a collaborator
projectSchema.methods.isCollaborator = function(userId) {
  return this.collaborators.some(collaborator => 
    collaborator.user.toString() === userId.toString() && 
    collaborator.status === 'Active'
  );
};

// Method to add a collaborator
projectSchema.methods.addCollaborator = async function(userId, role) {
  if (!this.collaborators.some(c => c.user.toString() === userId.toString())) {
    this.collaborators.push({
      user: userId,
      role,
      status: 'Pending'
    });
    await this.save();
  }
};

// Method to handle project join request
projectSchema.methods.handleJoinRequest = async function(userId, openingId, status) {
  const opening = this.openings.id(openingId);
  if (!opening) throw new Error('Opening not found');

  const applicant = opening.applicants.find(a => a.user.toString() === userId.toString());
  if (!applicant) throw new Error('Application not found');

  applicant.status = status;
  
  if (status === 'Accepted') {
    opening.status = 'Filled';
    opening.filledBy = userId;
    await this.addCollaborator(userId, opening.role);
  }

  await this.save();
};

const Project = mongoose.model('Project', projectSchema);

export default Project; 