const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const auth = require('../middleware/auth');

// Get all jobs
router.get('/', auth, async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching jobs' });
  }
});

// Create a new job
router.post('/', auth, async (req, res) => {
  try {
    const { jobName, company, lpa, openings, contact, description } = req.body;

    // Validate required fields
    if (!jobName || !company || !lpa || !openings || !contact || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const job = new Job({
      jobName,
      company,
      lpa,
      openings,
      contact,
      description,
      createdBy: req.user._id
    });

    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ message: 'Error creating job posting' });
  }
});

// Delete a job
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if the user is the creator of the job
    if (job.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this job' });
    }

    await job.remove();
    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting job' });
  }
});

// Get jobs posted by the current user
router.get('/my-posts', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your job posts' });
  }
});

module.exports = router; 