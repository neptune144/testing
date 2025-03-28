import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Project from '../models/Project.js';
import Chat from '../models/Chat.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/modules';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Get all available projects (excluding user's own projects)
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({
      owner: { $ne: req.user._id },
      'openings.status': 'Open'
    })
    .populate('owner', 'name username')
    .populate('openings.applicants.user', 'name username')
    .select('name description technologies githubUrl liveUrl openings deadline');

    // Filter out projects where the user has already applied
    const availableProjects = projects.map(project => {
      const hasRequested = project.openings.some(opening =>
        opening.applicants?.some(applicant => 
          applicant.user._id.toString() === req.user._id.toString()
        )
      );
      return {
        ...project.toObject(),
        hasRequested
      };
    });

    res.json(availableProjects);
  } catch (error) {
    console.error('Error fetching available projects:', error);
    res.status(500).json({ message: 'Error fetching available projects', error: error.message });
  }
});

// Get pending requests count
router.get('/requests/count', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id });
    let totalRequests = 0;
    
    projects.forEach(project => {
      project.openings.forEach(opening => {
        if (opening.applicants) {
          totalRequests += opening.applicants.filter(a => a.status === 'Pending').length;
        }
      });
    });
    
    res.json({ count: totalRequests });
  } catch (error) {
    console.error('Error counting requests:', error);
    res.status(500).json({ message: 'Error counting requests', error: error.message });
  }
});

// Get all pending requests for user's projects
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id })
      .populate('openings.applicants.user', 'name username email')
      .select('name openings');
    
    const requests = [];
    projects.forEach(project => {
      project.openings.forEach(opening => {
        if (opening.applicants) {
          const pendingApplicants = opening.applicants.filter(a => a.status === 'Pending');
          pendingApplicants.forEach(applicant => {
            requests.push({
              projectId: project._id,
              projectName: project.name,
              openingId: opening._id,
              role: opening.role,
              applicant: applicant.user,
              requestId: applicant._id,
              appliedAt: applicant.appliedAt
            });
          });
        }
      });
    });
    
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Get all projects for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    })
    .populate('owner', 'name username avatar')
    .populate('collaborators.user', 'name username avatar')
    .sort({ updatedAt: -1 });
    
    // Transform the response to include role information
    const transformedProjects = projects.map(project => {
      const projectObj = project.toObject();
      if (projectObj.owner._id.toString() === req.user._id.toString()) {
        projectObj.role = 'owner';
      } else {
        const collaborator = projectObj.collaborators.find(
          c => c.user._id.toString() === req.user._id.toString()
        );
        projectObj.role = collaborator ? collaborator.role : 'collaborator';
      }
      return projectObj;
    });

    res.json(transformedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
});

// Get a single project by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name username')
      .populate('collaborators.user', 'name username');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if user has access to the project
    const isOwner = project.owner._id.toString() === req.user._id.toString();
    const isCollaborator = project.collaborators.some(c => 
      c.user._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project', error: error.message });
  }
});

// Create a new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, technologies, githubUrl, liveUrl, openings, deadline } = req.body;
    
    const project = new Project({
      name,
      description,
      technologies,
      githubUrl,
      liveUrl,
      deadline: new Date(deadline),
      owner: req.user._id,
      openings: openings?.map(opening => ({
        role: opening.role,
        description: opening.description,
        skills: opening.skills || [],
        status: 'Open'
      })) || []
    });

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error creating project', error: error.message });
  }
});

// Update a project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, technologies, githubUrl, liveUrl, openings, deadline } = req.body;

    const project = await Project.findOne({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    project.name = name;
    project.description = description;
    project.technologies = technologies;
    project.githubUrl = githubUrl;
    project.liveUrl = liveUrl;
    project.deadline = new Date(deadline);
    
    // Update openings if provided
    if (openings) {
      // Keep existing openings that have applicants
      const existingOpenings = project.openings.filter(opening => 
        opening.applicants && opening.applicants.length > 0
      );

      // Add new openings
      const newOpenings = openings.map(opening => ({
        role: opening.role,
        description: opening.description,
        skills: opening.skills || [],
        status: 'Open',
        applicants: []
      }));

      project.openings = [...existingOpenings, ...newOpenings];
    }

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error updating project', error: error.message });
  }
});

// Delete a project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting project', error: error.message });
  }
});

// Add a collaborator to a project
router.post('/:id/collaborators', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { collaboratorId } = req.body;

    const project = await Project.findOne({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    if (project.collaborators.includes(collaboratorId)) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    project.collaborators.push(collaboratorId);
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error adding collaborator', error: error.message });
  }
});

// Remove a collaborator from a project
router.delete('/:id/collaborators/:collaboratorId', authenticateToken, async (req, res) => {
  try {
    const { id, collaboratorId } = req.params;

    const project = await Project.findOne({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    project.collaborators = project.collaborators.filter(
      c => c.toString() !== collaboratorId
    );
    
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error removing collaborator', error: error.message });
  }
});

// Submit a request to join a project
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { projectId, openingId, message } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const opening = project.openings.id(openingId);
    if (!opening) {
      return res.status(404).json({ message: 'Opening not found' });
    }

    if (opening.status !== 'Open') {
      return res.status(400).json({ message: 'This position is no longer open' });
    }

    // Check if user has already applied
    const existingApplication = opening.applicants.find(
      applicant => applicant.user.toString() === req.user._id.toString()
    );

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied for this position' });
    }

    // Add the application
    opening.applicants.push({
      user: req.user._id,
      message
    });

    await project.save();
    res.json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Error submitting project request:', error);
    res.status(500).json({ message: 'Error submitting project request' });
  }
});

// Accept a project request
router.post('/requests/:requestId/accept', authenticateToken, async (req, res) => {
  try {
    const { projectId, openingId } = req.body;
    const project = await Project.findOne({ 
      _id: projectId,
      owner: req.user._id
    }).populate('owner', 'name username');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const opening = project.openings.id(openingId);
    if (!opening) {
      return res.status(404).json({ message: 'Opening not found' });
    }

    const applicant = opening.applicants.find(a => a._id.toString() === req.params.requestId);
    if (!applicant) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // First handle the join request
    await project.handleJoinRequest(applicant.user, openingId, 'Accepted');

    try {
      // Check if a chat already exists for this project and participants
      let chat = await Chat.findOne({
        type: 'project',
        project: projectId,
        participants: { 
          $all: [req.user._id, applicant.user],
          $size: 2 
        }
      });

      if (!chat) {
        // Create a new chat if one doesn't exist
        chat = await Chat.create({
          type: 'project',
          participants: [req.user._id, applicant.user],
          project: projectId,
          messages: [{
            sender: req.user._id,
            content: `Welcome to the project chat for ${project.name}! Project deadline: ${new Date(project.deadline).toLocaleDateString()}`,
            readBy: [{ user: req.user._id }]
          }]
        });

        // Populate the chat with necessary information
        await chat.populate('participants', 'name username');
        await chat.populate('project', 'name deadline');
        
        // Set the last message
        chat.lastMessage = chat.messages[0];
        await chat.save();
      }

      res.json({ 
        message: 'Request accepted successfully',
        chat: chat
      });
    } catch (chatError) {
      console.error('Error creating project chat:', chatError);
      // Still send success response but include chat error
      res.json({ 
        message: 'Request accepted successfully, but chat creation failed',
        chatError: chatError.message
      });
    }
  } catch (error) {
    console.error('Error accepting project request:', error);
    res.status(500).json({ message: 'Error accepting project request', error: error.message });
  }
});

// Reject a project request
router.post('/requests/:requestId/reject', authenticateToken, async (req, res) => {
  try {
    const { projectId, openingId } = req.body;
    const project = await Project.findOne({ 
      _id: projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const opening = project.openings.id(openingId);
    if (!opening) {
      return res.status(404).json({ message: 'Opening not found' });
    }

    const applicant = opening.applicants.find(a => a._id.toString() === req.params.requestId);
    if (!applicant) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await project.handleJoinRequest(applicant.user, openingId, 'Rejected');
    res.json({ message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting project request:', error);
    res.status(500).json({ message: 'Error rejecting project request' });
  }
});

// Update project progress
router.put('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { completionPercentage, lastUpdated } = req.body;

    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // Validate completion percentage
    if (completionPercentage === undefined || isNaN(completionPercentage)) {
      return res.status(400).json({ message: 'Valid completion percentage is required' });
    }

    const percentage = parseInt(completionPercentage);
    if (percentage < 0 || percentage > 100) {
      return res.status(400).json({ message: 'Completion percentage must be between 0 and 100' });
    }

    // Update project progress
    project.completionPercentage = percentage;
    project.lastUpdated = lastUpdated || new Date();
    await project.save();

    res.json({
      message: 'Project progress updated successfully',
      project: {
        _id: project._id,
        name: project.name,
        progressData: {
          completionPercentage: project.completionPercentage,
          lastUpdated: project.lastUpdated
        }
      }
    });
  } catch (error) {
    console.error('Error updating project progress:', error);
    res.status(500).json({ message: 'Error updating project progress', error: error.message });
  }
});

// Submit a module
router.post('/:id/modules', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completionPercentage, githubLink } = req.body;
    const files = req.files || [];

    console.log('Received module submission request:', {
      projectId: id,
      userId: req.user._id,
      body: req.body,
      files: files.map(f => ({
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype
      }))
    });

    // Validate required fields
    if (!title || !title.trim()) {
      console.error('Module submission failed: Missing title');
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({ message: 'Module title is required' });
    }

    if (completionPercentage === undefined || completionPercentage === '') {
      console.error('Module submission failed: Missing completion percentage');
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({ message: 'Completion percentage is required' });
    }

    const percentage = parseInt(completionPercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      console.error('Module submission failed: Invalid completion percentage', { percentage });
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(400).json({ message: 'Completion percentage must be a number between 0 and 100' });
    }

    // Find project and validate access
    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!project) {
      console.error('Module submission failed: Project not found or unauthorized', {
        projectId: id,
        userId: req.user._id
      });
      // Clean up uploaded files
      files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // Create module submission
    const moduleSubmission = {
      title: title.trim(),
      description: description ? description.trim() : '',
      completionPercentage: percentage,
      submittedBy: req.user._id,
      githubLink: githubLink || null,
      files: files.map(file => ({
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }))
    };

    project.moduleSubmissions.push(moduleSubmission);

    // Calculate and update project progress
    const totalProgress = project.moduleSubmissions.reduce((sum, module) => 
      sum + (module.completionPercentage || 0), 0);
    const averageProgress = Math.round(totalProgress / project.moduleSubmissions.length);
    
    // Save progress data
    project.markModified('moduleSubmissions');
    await project.save();

    // Find project chat
    const chat = await Chat.findOne({
      type: 'project',
      project: project._id
    }).populate('messages.sender', 'name username avatar');

    if (!chat) {
      console.error('Chat not found for project:', project._id);
      return res.status(404).json({ message: 'Chat not found for project' });
    }

    // Create chat message with GitHub link
    const messageContent = `Module Submitted: ${title} (${percentage}% complete)${githubLink ? ' - View Repository' : ''}`;
    const message = {
      sender: req.user._id,
      content: messageContent,
      githubLink: githubLink || null,
      attachments: [{
        type: 'module',
        moduleData: {
          title,
          description,
          completionPercentage: percentage,
          githubLink: githubLink || null
        }
      }],
      readBy: [{ user: req.user._id }],
      createdAt: new Date()
    };

    // Add message to chat
    chat.messages.push(message);
    chat.lastMessage = {
      content: messageContent,
      sender: req.user._id,
      createdAt: new Date(),
      hasAttachment: true,
      githubLink: githubLink || null
    };

    await chat.save();

    // Get the newly added message
    const newMessage = chat.messages[chat.messages.length - 1];

    // Manually construct the populated sender object
    const populatedMessage = {
      _id: newMessage._id,
      content: newMessage.content,
      sender: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar
      },
      createdAt: newMessage.createdAt,
      githubLink: newMessage.githubLink,
      attachments: newMessage.attachments
    };

    // Include project progress data in the response
    const progressData = {
      completionPercentage: project.progressData.completionPercentage,
      lastUpdated: new Date()
    };

    res.status(201).json({
      message: 'Module submitted successfully',
      chatMessage: populatedMessage,
      project: {
        _id: project._id,
        name: project.name,
        progressData
      }
    });

  } catch (error) {
    console.error('Error submitting module:', error, {
      body: req.body,
      files: req.files?.map(f => ({
        originalname: f.originalname,
        size: f.size
      }))
    });

    // Clean up any uploaded files if there was an error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error cleaning up file:', err);
        }
      });
    }

    res.status(500).json({ 
      message: 'Error submitting module', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 