import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert to object and remove sensitive fields
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.verificationToken;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    
    res.json(userObj);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Error fetching user profile', error: err.message });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      bio,
      githubUrl,
      portfolioUrl,
      linkedinUrl,
      skills,
      experienceLevel,
      location,
      availability,
      interests
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (bio !== undefined) user.bio = bio;
    if (githubUrl !== undefined) user.githubUrl = githubUrl;
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl;
    if (linkedinUrl !== undefined) user.linkedinUrl = linkedinUrl;
    if (skills !== undefined) user.skills = skills;
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel;
    if (location !== undefined) user.location = location;
    if (availability !== undefined) user.availability = availability;
    if (interests !== undefined) user.interests = interests;

    await user.save();

    // Convert to object and remove sensitive fields
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.verificationToken;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;

    res.json(userObj);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Get user by ID
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Search users
router.get('/search/:query', authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const users = await User.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error searching users' });
  }
});

export default router; 