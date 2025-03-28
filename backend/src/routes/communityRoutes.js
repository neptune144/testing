import express from 'express';
import { authenticateToken as authenticateUser } from '../middleware/auth.js';
import Community from '../models/Community.js';
import Message from '../models/Message.js';
import Webinar from '../models/Webinar.js';

const router = express.Router();

// Get all communities
router.get('/communities', authenticateUser, async (req, res) => {
  try {
    const communities = await Community.find()
      .populate('creator', 'name email')
      .populate('members', 'name email');
    res.json(communities);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching communities' });
  }
});

// Create a new community
router.post('/create-community', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;
    const community = new Community({
      name,
      description,
      creator: req.user._id,
      members: [req.user._id],
      admins: [req.user._id]
    });
    await community.save();
    
    const populatedCommunity = await Community.findById(community._id)
      .populate('creator', 'name email')
      .populate('members', 'name email');
    
    res.status(201).json(populatedCommunity);
  } catch (err) {
    res.status(500).json({ message: 'Error creating community' });
  }
});

// Get community details
router.get('/communities/:communityId', authenticateUser, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId)
      .populate('creator', 'name email')
      .populate('members', 'name email')
      .populate('admins', 'name email');
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    res.json(community);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching community details' });
  }
});

// Join a community
router.post('/communities/:communityId/join', authenticateUser, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    if (community.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already a member of this community' });
    }
    
    community.members.push(req.user._id);
    await community.save();
    
    const populatedCommunity = await Community.findById(community._id)
      .populate('creator', 'name email')
      .populate('members', 'name email')
      .populate('admins', 'name email');
    
    res.json(populatedCommunity);
  } catch (err) {
    res.status(500).json({ message: 'Error joining community' });
  }
});

// Get community messages
router.get('/communities/:communityId/messages', authenticateUser, async (req, res) => {
  try {
    const messages = await Message.find({ community: req.params.communityId })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Send a message in community
router.post('/communities/:communityId/messages', authenticateUser, async (req, res) => {
  try {
    const { content } = req.body;
    const message = new Message({
      community: req.params.communityId,
      sender: req.user._id,
      content
    });
    await message.save();
    
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email');
    
    // Emit socket event for real-time updates
    req.app.get('io').to(req.params.communityId).emit('newMessage', populatedMessage);
    
    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Get community webinars
router.get('/communities/:communityId/webinars', authenticateUser, async (req, res) => {
  try {
    const webinars = await Webinar.find({ community: req.params.communityId })
      .populate('creator', 'name email')
      .sort({ scheduledDate: 1 });
    res.json(webinars);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching webinars' });
  }
});

// Create a webinar
router.post('/communities/:communityId/webinars', authenticateUser, async (req, res) => {
  try {
    const { name, description, link, scheduledDate } = req.body;
    const webinar = new Webinar({
      community: req.params.communityId,
      creator: req.user._id,
      name,
      description,
      link,
      scheduledDate
    });
    await webinar.save();
    
    const populatedWebinar = await Webinar.findById(webinar._id)
      .populate('creator', 'name email');
    
    res.status(201).json(populatedWebinar);
  } catch (err) {
    res.status(500).json({ message: 'Error creating webinar' });
  }
});

// Delete a webinar
router.delete('/communities/:communityId/webinars/:webinarId', authenticateUser, async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: 'Webinar not found' });
    }
    
    // Check if user is community admin or webinar creator
    const community = await Community.findById(req.params.communityId);
    if (!community.admins.includes(req.user._id) && webinar.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this webinar' });
    }
    
    await webinar.remove();
    res.json({ message: 'Webinar deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting webinar' });
  }
});

export default router; 