const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  lpa: {
    type: Number,
    required: true
  },
  openings: {
    type: Number,
    required: true,
    min: 1
  },
  contact: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job; 