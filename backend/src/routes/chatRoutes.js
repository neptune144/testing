import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getUserChats,
  getOrCreateDirectChat,
  getChatMessages,
  sendMessage,
  createProjectChat,
  addChatParticipant,
  removeChatParticipant
} from '../controllers/chatController.js';
import Chat from '../models/Chat.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Message from '../models/Message.js';
import Project from '../models/Project.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir = 'uploads/chat';
    
    // Create different directories for different file types
    if (req.body.type === 'image') {
      uploadDir = 'uploads/chat/images';
    } else if (req.body.type === 'code') {
      uploadDir = 'uploads/chat/code';
    } else {
      uploadDir = 'uploads/chat/files';
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Helper function to detect file type and get language
const getFileInfo = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const codeExtensions = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust'
  };

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  
  if (codeExtensions[ext]) {
    return {
      type: 'code',
      language: codeExtensions[ext]
    };
  } else if (imageExtensions.includes(ext)) {
    return {
      type: 'image'
    };
  }
  
  return {
    type: 'file'
  };
};

// Apply authentication middleware to all chat routes
router.use(authenticateToken);

// Get all chats for the authenticated user
router.get('/', async (req, res) => {
  try {
    console.log('Fetching chats for user:', req.user._id);
    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'username email name')
      .populate({
        path: 'project',
        select: 'name title deadline progressData moduleSubmissions',
        populate: {
          path: 'owner',
          select: 'username email name'
        }
      })
      .sort({ updatedAt: -1 });

    console.log('Found chats:', chats.length);
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Error fetching chats', error: error.message });
  }
});

// Get or create a direct chat with another user
router.get('/direct/:userId', getOrCreateDirectChat);

// Get messages for a specific chat
router.get('/:chatId/messages', getChatMessages);

// Send a message in a chat
router.post('/:chatId/messages', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    let projectProgress = null;

    // Parse project progress if provided
    if (req.body.projectProgress) {
      try {
        projectProgress = JSON.parse(req.body.projectProgress);
      } catch (error) {
        console.error('Error parsing project progress:', error);
      }
    }

    const chat = await Chat.findById(chatId)
      .populate('project')
      .populate('participants', 'name username avatar');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is a participant
    if (!chat.participants.some(p => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }

    // Handle file uploads
    const attachments = req.files ? req.files.map(file => ({
      url: file.path,
      filename: file.filename,
      mimetype: file.mimetype
    })) : [];

    // Create message
    const message = new Message({
      chat: chatId,
      sender: req.user._id,
      content: content || '',
      attachments
    });

    // Add project progress if available
    if (projectProgress && chat.type === 'project') {
      message.projectProgress = {
        projectId: projectProgress.projectId,
        completionPercentage: projectProgress.completionPercentage,
        deadline: projectProgress.deadline
      };

      // Update project completion percentage
      await Project.findByIdAndUpdate(projectProgress.projectId, {
        completionPercentage: projectProgress.completionPercentage,
        lastUpdated: new Date()
      });
    }

    await message.save();
    chat.messages.push(message._id);
    await chat.save();

    // Populate message details
    await message.populate('sender', 'name username avatar');
    if (message.projectProgress?.projectId) {
      await message.populate('projectProgress.projectId', 'name deadline');
    }

    // Emit socket event
    if (req.app.get('io')) {
      req.app.get('io').to(chatId).emit('message', {
        ...message.toObject(),
        chat: chatId
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Error creating message', error: error.message });
  }
});

// Create a project chat
router.post('/project/:projectId', createProjectChat);

// Add participant to a chat
router.post('/:chatId/participants/:userId', addChatParticipant);

// Remove participant from a chat
router.delete('/:chatId/participants/:userId', removeChatParticipant);

// Upload file to chat
router.post('/:chatId/upload', upload.single('file'), async (req, res) => {
  try {
    const { chatId } = req.params;
    const file = req.file;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Chat not found or unauthorized' });
    }

    const fileInfo = getFileInfo(file);
    let preview = '';

    // Generate preview for code files
    if (fileInfo.type === 'code') {
      try {
        const content = fs.readFileSync(file.path, 'utf8');
        preview = content.split('\n').slice(0, 5).join('\n'); // First 5 lines
      } catch (err) {
        console.error('Error reading code file:', err);
      }
    }

    const message = await chat.addMessage(req.user._id, 
      `Shared a ${fileInfo.type === 'code' ? `${fileInfo.language} file` : fileInfo.type}: ${file.originalname}`,
      [{
        type: fileInfo.type,
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        language: fileInfo.language,
        preview: preview
      }]
    );

    await message.populate('sender', 'username email name');

    res.json(message);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(400).json({ message: 'Error uploading file', error: error.message });
  }
});

// In your GET chat route
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'username email')
      .populate({
        path: 'project',
        select: 'title deadline progressData moduleSubmissions',
        populate: {
          path: 'owner',
          select: 'username email'
        }
      })
      .populate({
        path: 'messages',
        populate: {
          path: 'sender',
          select: 'username email'
        }
      });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Error fetching chat details' });
  }
});

export default router; 