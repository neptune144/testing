import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js';
import Project from '../models/Project.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join('uploads', 'modules');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Submit a module
router.post('/submit', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { projectId, chatId, title, description, completionPercentage } = req.body;

    // Validate required fields
    if (!projectId || !chatId || !title) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: { projectId, chatId, title },
        received: req.body
      });
    }

    // Validate project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user is part of the project
    const isParticipant = project.participants.some(p => p.user.toString() === req.user._id.toString());
    if (!project.owner.equals(req.user._id) && !isParticipant) {
      return res.status(403).json({ message: 'Not authorized to submit modules to this project' });
    }

    // Validate chat exists and is a project chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.type !== 'project' || !chat.project.equals(projectId)) {
      return res.status(400).json({ message: 'Invalid chat type or project mismatch' });
    }

    // Process uploaded files
    const attachments = req.files.map(file => ({
      type: 'module',
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      moduleData: {
        title,
        description: description || '',
        completionPercentage: parseInt(completionPercentage) || 0
      }
    }));

    // Add message to chat
    const messageContent = `Submitted module: ${title}${description ? ` - ${description}` : ''}`;
    const message = await chat.addMessage(req.user._id, messageContent, attachments);

    // Update project progress if completion percentage is provided
    if (completionPercentage) {
      project.updateProgress(parseInt(completionPercentage));
      await project.save();
    }

    // Populate message details
    await message.populate('sender', 'name username avatar');

    res.status(201).json({
      message: 'Module submitted successfully',
      chatMessage: message,
      project: {
        _id: project._id,
        name: project.name,
        progress: project.progressData
      }
    });

  } catch (error) {
    console.error('Module submission error:', error);
    res.status(500).json({ 
      message: 'Error submitting module', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 