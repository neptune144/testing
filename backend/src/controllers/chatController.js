import Chat from '../models/Chat.js';
import User from '../models/User.js';

// Get all chats for a user
export const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    })
    .populate('participants', 'name username avatar')
    .populate('project', 'name _id description deadline')
    .populate('lastMessage.sender', 'name username avatar')
    .sort('-updatedAt');

    // Log the populated chats for debugging
    console.log('Populated chats:', chats.map(chat => ({
      id: chat._id,
      type: chat.type,
      projectId: chat.project?._id,
      projectName: chat.project?.name
    })));

    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Error fetching chats', error: error.message });
  }
};

// Get or create a direct chat with another user
export const getOrCreateDirectChat = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get or create chat
    const chat = await Chat.getOrCreateDirectChat(req.user._id, userId);
    
    await chat.populate('participants', 'name username avatar');
    await chat.populate('messages.sender', 'name username avatar');

    res.json(chat);
  } catch (error) {
    console.error('Get/Create chat error:', error);
    res.status(500).json({ message: 'Error accessing chat', error: error.message });
  }
};

// Get chat messages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId)
      .populate('messages.sender', 'name username avatar')
      .populate('messages.readBy.user', 'name username');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    // Mark messages as read
    await chat.markAsRead(req.user._id);

    res.json(chat.messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }

    // Add message
    const message = await chat.addMessage(req.user._id, content.trim());
    
    // Populate sender details
    await Chat.populate(message, {
      path: 'sender',
      select: 'name username avatar'
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// Create a project chat
export const createProjectChat = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check if project chat already exists
    let chat = await Chat.findOne({
      type: 'project',
      project: projectId
    });

    if (chat) {
      return res.status(400).json({ message: 'Project chat already exists' });
    }

    // Create new project chat
    chat = await Chat.create({
      type: 'project',
      project: projectId,
      participants: [req.user._id] // Initially only creator
    });

    await chat.populate('participants', 'name username avatar');
    await chat.populate('project', 'name');

    res.status(201).json(chat);
  } catch (error) {
    console.error('Create project chat error:', error);
    res.status(500).json({ message: 'Error creating project chat', error: error.message });
  }
};

// Add participant to project chat
export const addChatParticipant = async (req, res) => {
  try {
    const { chatId, userId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is already a participant
    if (chat.participants.some(p => p.toString() === userId)) {
      return res.status(400).json({ message: 'User is already a participant' });
    }

    // Add participant
    chat.participants.push(userId);
    await chat.save();

    await chat.populate('participants', 'name username avatar');

    res.json(chat);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ message: 'Error adding participant', error: error.message });
  }
};

// Remove participant from project chat
export const removeChatParticipant = async (req, res) => {
  try {
    const { chatId, userId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Remove participant
    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    await chat.save();

    await chat.populate('participants', 'name username avatar');

    res.json(chat);
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ message: 'Error removing participant', error: error.message });
  }
}; 