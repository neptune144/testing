import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  CircularProgress,
  Alert,
  Divider,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Fade
} from '@mui/material';
import {
  Send,
  AttachFile,
  Schedule,
  Image,
  Description,
  Assignment,
  Close,
  AccessTime,
  GitHub
} from '@mui/icons-material';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import storage from '../utils/storage';
import io from 'socket.io-client';

const ChatWindow = ({ chat }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [projectDetails, setProjectDetails] = useState(null);
  const [uploadAnchorEl, setUploadAnchorEl] = useState(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleData, setModuleData] = useState({
    title: '',
    description: '',
    completionPercentage: 0,
    githubLink: ''
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [projectId, setProjectId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesContainerRef = useRef(null);
  const observerRef = useRef(null);
  const [isSending, setIsSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      setError('Please log in to use the chat');
      return;
    }

    // Initialize socket connection with authentication
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      withCredentials: true,
      forceNew: true,
      path: '/socket.io/',
      auth: {
        token: token
      }
    });

    // Handle connection events
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
      setError('');
      socket.emit('join_chat', projectId);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      
      // Handle authentication errors
      if (error.message.includes('Authentication error')) {
        setError('Authentication failed. Please log in again.');
        return;
      }
      
      setError('Connection error. Attempting to reconnect...');
      
      // Try polling if websocket fails
      if (socket.io.opts.transports.includes('websocket')) {
        socket.io.opts.transports = ['polling', 'websocket'];
        socket.connect();
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        socket.connect();
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Attempting to reconnect:', attemptNumber);
      setError(`Reconnecting... Attempt ${attemptNumber}`);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError('');
      socket.emit('join_chat', projectId);
    });

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setIsConnected(false);
      setError('Connection lost. Please refresh the page to reconnect.');
    });

    // Handle incoming messages
    socket.on('receive_message', (message) => {
      console.log('Received message:', message);
      if (message.message) {
        // Handle message from socket emission
        handleMessageUpdate({
          _id: message.message._id,
          content: message.message.content,
          sender: message.message.sender,
          createdAt: message.message.createdAt,
          githubLink: message.message.githubLink,
          attachments: message.message.attachments || []
        });

        // Update project progress only if it's a module submission message
        if (message.message.content.includes('submitted with') && message.message.content.includes('% completion')) {
          const percentageMatch = message.message.content.match(/(\d+)% completion/);
          if (percentageMatch && percentageMatch[1]) {
            const completionPercentage = parseInt(percentageMatch[1]);
            console.log('Updating project progress from module submission:', {
              messageId: message.message._id,
              content: message.message.content,
              extractedPercentage: completionPercentage
            });

            setProjectDetails(prev => ({
              ...prev,
              progressData: {
                completionPercentage: completionPercentage,
                lastUpdated: new Date()
              }
            }));
          }
        }
      } else {
        // Handle direct message
        handleMessageUpdate(message);
      }
    });

    // Handle typing status
    socket.on('user_typing', (data) => {
      if (data.userId !== storage.getUser()?._id) {
        setTypingUsers(prev => {
          const newUsers = new Set(prev);
          newUsers.add(data.username);
          return newUsers;
        });
        
        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const newUsers = new Set(prev);
            newUsers.delete(data.username);
            return newUsers;
          });
        }, 3000);
      }
    });

    // Store socket instance
    setSocket(socket);

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.emit('leave_chat', projectId);
        socket.disconnect();
      }
    };
  }, [projectId]);

  useEffect(() => {
    console.log('Chat object changed:', {
      chat,
      chatId: chat?._id,
      projectRef: chat?.project,
      projectId: typeof chat?.project === 'string' ? chat.project : chat?.project?._id
    });
  }, [chat]);

  useEffect(() => {
    if (chat) {
      console.log('Chat object received:', {
        chatId: chat._id,
        type: chat.type,
        project: chat.project,
        projectType: typeof chat.project,
        projectId: chat.project?._id || chat.project,
        isProjectChat: chat.type === 'project',
        hasValidProject: Boolean(chat.project?._id || (typeof chat.project === 'string' && chat.project))
      });
    }
  }, [chat]);

  useEffect(() => {
    if (!chat) return;

    console.log('Initializing chat with project data:', {
      chatId: chat._id,
      type: chat.type,
      project: chat.project,
      projectType: typeof chat.project,
      rawProjectId: typeof chat.project === 'string' ? chat.project : chat.project?._id
    });

    if (chat.type === 'project') {
      let extractedId = null;
      
      if (typeof chat.project === 'string') {
        extractedId = chat.project;
      } else if (chat.project?._id) {
        extractedId = chat.project._id;
      }

      console.log('Project ID extraction result:', {
        fromString: typeof chat.project === 'string' ? chat.project : null,
        fromObject: chat.project?._id,
        extracted: extractedId,
        isValid: extractedId && /^[0-9a-fA-F]{24}$/.test(extractedId)
      });

      if (extractedId && /^[0-9a-fA-F]{24}$/.test(extractedId)) {
        console.log('Setting valid project ID:', extractedId);
        setProjectId(extractedId);
        
        setTimeout(() => {
          fetchProjectDetails(extractedId).catch(err => {
            console.error('Failed to fetch project details:', err);
            setError('Failed to load project details');
          });
        }, 500);
      } else {
        console.error('Invalid project ID structure:', {
          extractedId,
          chatProject: chat.project
        });
        setError('Invalid project configuration. Please try refreshing the page.');
        setProjectId(null);
      }
    }
  }, [chat]);

  const fetchProjectDetails = async (id) => {
    try {
      setIsLoadingProject(true);
      setError('');
      console.log('Fetching project details for ID:', id);

      const token = storage.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch project details');
      }

      const data = await response.json();
      console.log('Project details received:', data);
      
      const cleanedData = {
        _id: id,
        name: data?.name || 'Unnamed Project',
        description: data?.description || '',
        deadline: data?.deadline || null,
        status: data?.status || 'Planning',
        owner: data?.owner || null,
        progressData: {
          completionPercentage: data?.progressData?.completionPercentage || 0,
          lastUpdated: data?.progressData?.lastUpdated || new Date()
        }
      };

      if (!cleanedData._id || !cleanedData.name) {
        console.warn('Incomplete project data received:', data);
        setProjectDetails(cleanedData);
      } else {
        setProjectDetails(cleanedData);
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError(err.message || 'Failed to load project details');
      setProjectDetails(null);
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleMessageUpdate = (message) => {
    if (!message || !message._id) {
      console.warn('Invalid message received:', message);
      return;
    }

    setMessages(prev => {
      // Check if message already exists
      const existingIndex = prev.findIndex(m => m._id === message._id);
      if (existingIndex >= 0) {
        // Update existing message
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...message,
          sender: message.sender || updated[existingIndex].sender || { _id: 'unknown', name: 'Unknown User' },
          createdAt: message.createdAt || updated[existingIndex].createdAt,
          githubLink: message.githubLink || updated[existingIndex].githubLink
        };
        return updated;
      }
      // Add new message with default values
      return [...prev, {
        _id: message._id,
        content: message.content || '',
        sender: message.sender || { _id: 'unknown', name: 'Unknown User' },
        createdAt: message.createdAt || new Date(),
        attachments: message.attachments || [],
        readBy: message.readBy || [],
        githubLink: message.githubLink
      }];
    });

    // Only auto-scroll for new messages if we're at the bottom
    if (shouldAutoScroll) {
      scrollToBottom(true);
    }
  };

  useEffect(() => {
    if (chat?._id) {
      fetchMessages();
    }
  }, [chat?._id]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chat._id}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      console.log('Fetched messages:', data);

      // Transform messages
      const transformedMessages = data.map(message => ({
        _id: message._id,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt,
        githubLink: message.githubLink || (message.attachments?.[0]?.moduleData?.githubLink),
        attachments: message.attachments || []
      }));

      // Find the latest module submission message with completion percentage
      const moduleMessages = transformedMessages.filter(msg => 
        msg.content.includes('submitted with') && 
        msg.content.includes('% completion')
      );

      if (moduleMessages.length > 0) {
        const latestModuleMessage = moduleMessages[moduleMessages.length - 1];
        const percentageMatch = latestModuleMessage.content.match(/(\d+)% completion/);
        
        if (percentageMatch && percentageMatch[1]) {
          const completionPercentage = parseInt(percentageMatch[1]);
          console.log('Setting project progress from latest module message:', {
            messageId: latestModuleMessage._id,
            content: latestModuleMessage.content,
            extractedPercentage: completionPercentage
          });

          setProjectDetails(prev => ({
            ...prev,
            progressData: {
              completionPercentage: completionPercentage,
              lastUpdated: new Date(latestModuleMessage.createdAt)
            }
          }));
        }
      }

      setMessages(transformedMessages);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!newMessage.trim() && !selectedFiles.length) return;

    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append('content', newMessage);
      
      // Add project progress information if this is a project chat
      if (chat.type === 'project' && chat.project) {
        formData.append('projectProgress', JSON.stringify({
          projectId: chat.project._id,
          completionPercentage: chat.project.completionPercentage || 0,
          deadline: chat.project.deadline
        }));
      }

      // Add files if any
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chat._id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storage.getToken()}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage = await response.json();
      
      // Update messages state
      setMessages(prev => [...prev, newMessage]);
      
      // Clear input and files
      setNewMessage('');
      setSelectedFiles([]);
      setIsSending(false);

      // Emit socket event for real-time updates
      socket?.emit('message', {
        ...newMessage,
        chat: chat._id
      });

      // Scroll to bottom
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (!socket) return;
    
    socket.emit('typing', {
      chatId: chat._id,
      userId: storage.getUser()?._id,
      username: storage.getUser()?.name
    });
  };

  // Add debounced typing handler
  useEffect(() => {
    const typingTimeout = setTimeout(() => {
      if (newMessage.trim()) {
        handleTyping();
      }
    }, 500);

    return () => clearTimeout(typingTimeout);
  }, [newMessage]);

  // Update scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      setShouldAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);

    // Initial scroll position
    if (messages.length > 0 && shouldAutoScroll) {
      scrollToBottom(true);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []); // Remove messages.length dependency

  // Separate effect for handling new messages
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      scrollToBottom(true);
    }
  }, [messages, shouldAutoScroll]);

  // Update scrollToBottom function
  const scrollToBottom = (force = false) => {
    if (!force && !shouldAutoScroll) return;
    
    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      container.scrollTo({
        top: maxScroll,
        behavior: 'smooth'
      });
    });
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return '';
    const date = new Date(deadline);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = date.toLocaleDateString(undefined, options);

    if (diffDays < 0) {
      return `${formattedDate} (Overdue)`;
    } else if (diffDays <= 3) {
      return `${formattedDate} (${diffDays} days left!)`;
    } else if (diffDays <= 7) {
      return `${formattedDate} (${diffDays} days remaining)`;
    }
    return formattedDate;
  };

  const getDeadlineColor = (deadline) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysRemaining = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return 'error';
    if (daysRemaining <= 3) return 'warning';
    if (daysRemaining <= 7) return 'info';
    return 'default';
  };

  const handleUploadClick = (event) => {
    setUploadAnchorEl(event.currentTarget);
  };

  const handleUploadClose = () => {
    setUploadAnchorEl(null);
  };

  const handleFileSelect = async (event, type) => {
    const files = Array.from(event.target.files);
    handleUploadClose();

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const tempId = Date.now().toString();
        setMessages(prev => [...prev, {
          _id: tempId,
          content: `Uploading ${type}: ${file.name}...`,
          sender: storage.getUser(),
          createdAt: new Date(),
          isLoading: true
        }]);

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chat._id}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storage.getToken()}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }

        const message = await response.json();
        
        setMessages(prev => prev.filter(m => m._id !== tempId));
        socket?.emit('new_message', { chatId: chat._id, ...message });
        scrollToBottom();
      } catch (err) {
        console.error('Error uploading file:', err);
        setError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
  };

  const handleModuleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!chat || chat.type !== 'project') {
        throw new Error('Invalid chat type or missing chat data');
      }

      let submissionProjectId = projectId;
      if (!submissionProjectId) {
        if (typeof chat.project === 'string') {
          submissionProjectId = chat.project;
        } else if (chat.project?._id) {
          submissionProjectId = chat.project._id;
        }
      }

      console.log('Module submission preparation:', {
        chatId: chat._id,
        storedProjectId: projectId,
        submissionProjectId,
        projectDetails: projectDetails,
        moduleData
      });

      if (!submissionProjectId || !/^[0-9a-fA-F]{24}$/.test(submissionProjectId)) {
        throw new Error('Project ID is missing or invalid. Please refresh the page and try again.');
      }

      if (!moduleData?.title?.trim()) {
        throw new Error('Module title is required');
      }

      // First, update the project's completion percentage
      const updateProgressResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${submissionProjectId}/progress`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          completionPercentage: moduleData.completionPercentage,
          lastUpdated: new Date()
        })
      });

      if (!updateProgressResponse.ok) {
        const errorData = await updateProgressResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update project progress');
      }

      // Then submit the module
      const formData = new FormData();
      formData.append('projectId', submissionProjectId);
      formData.append('chatId', chat._id);
      formData.append('title', moduleData.title.trim());
      formData.append('description', moduleData.description?.trim() || '');
      formData.append('completionPercentage', moduleData.completionPercentage.toString());

      if (moduleData.githubLink?.trim()) {
        formData.append('githubLink', moduleData.githubLink.trim());
      }

      if (moduleData.files?.length > 0) {
        moduleData.files.forEach(file => {
          formData.append('files', file);
        });
      }

      console.log('Submitting module with data:', {
        projectId: submissionProjectId,
        chatId: chat._id,
        title: moduleData.title,
        completionPercentage: moduleData.completionPercentage,
        githubLink: moduleData.githubLink,
        filesCount: moduleData.files?.length
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/${submissionProjectId}/modules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit module');
      }

      const result = await response.json();
      console.log('Module submission successful:', result);

      // Create message content
      const messageContent = `Module "${moduleData.title}" submitted with ${moduleData.completionPercentage}% completion.${moduleData.githubLink ? ' - View Repository' : ''}`;

      // Create the message object
      const message = {
        _id: result.chatMessage._id,
        content: messageContent,
        sender: result.chatMessage.sender,
        createdAt: result.chatMessage.createdAt,
        githubLink: moduleData.githubLink,
        projectProgress: {
          completionPercentage: moduleData.completionPercentage,
          lastUpdated: new Date()
        }
      };

      // Add the message to the chat
      setMessages(prev => [...prev, message]);

      // Update project details with the new completion percentage
      const updatedProjectDetails = {
        ...projectDetails,
        progressData: {
          completionPercentage: moduleData.completionPercentage,
          lastUpdated: new Date()
        }
      };
      setProjectDetails(updatedProjectDetails);

      // Emit the message to other users
      if (socket && isConnected) {
        socket.emit('new_message', { 
          chatId: chat._id, 
          message: {
            _id: message._id,
            content: messageContent,
            sender: message.sender,
            createdAt: message.createdAt,
            githubLink: moduleData.githubLink,
            projectProgress: {
              completionPercentage: moduleData.completionPercentage,
              lastUpdated: new Date()
            }
          }
        });
      }

      scrollToBottom();

      // Reset module data
      setModuleData({
        title: '',
        description: '',
        completionPercentage: 0,
        githubLink: ''
      });
      setModuleDialogOpen(false);
      setError('');

    } catch (err) {
      console.error('Module submission failed:', err);
      setError(err.message || 'Failed to submit module');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update the renderGitHubLink function to handle both message content and direct GitHub links
  const renderGitHubLink = (content, githubLink) => {
    if (!githubLink) return null;

    return (
      <Chip
        icon={<GitHub />}
        label="View Repository"
        component="a"
        href={githubLink}
        target="_blank"
        rel="noopener noreferrer"
        clickable
        size="small"
        variant="outlined"
        sx={{
          ml: 1,
          color: 'black',
          borderColor: 'black',
          '& .MuiChip-icon': {
            color: 'black'
          },
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)'
          }
        }}
      />
    );
  };

  const validateProjectId = (id) => {
    return id && /^[0-9a-fA-F]{24}$/.test(id);
  };

  const handleModuleDialogOpen = () => {
    const currentProjectId = projectId || 
      (typeof chat?.project === 'string' ? chat.project : chat?.project?._id);

    if (!validateProjectId(currentProjectId)) {
      console.error('Cannot open module dialog - invalid project ID:', {
        storedProjectId: projectId,
        chatProject: chat?.project
      });
      setError('Project configuration is invalid. Please refresh the page.');
      return;
    }

    setModuleDialogOpen(true);
    setError('');
  };

  const isModuleDataValid = () => {
    const title = moduleData.title?.trim();
    const completionPercentage = parseInt(moduleData.completionPercentage);
    return (
      title &&
      !isNaN(completionPercentage) &&
      completionPercentage > 0 &&
      completionPercentage <= 100
    );
  };

  const getDeadlineInfo = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysRemaining = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    
    let color = 'default';
    if (daysRemaining < 0) color = 'error';
    else if (daysRemaining <= 3) color = 'warning';
    else if (daysRemaining <= 7) color = 'info';

    let timeText = '';
    if (daysRemaining < 0) {
      timeText = `Overdue by ${Math.abs(daysRemaining)} days`;
    } else if (daysRemaining === 0) {
      timeText = 'Due today';
    } else if (daysRemaining === 1) {
      timeText = 'Due tomorrow';
    } else {
      timeText = `${daysRemaining} days remaining`;
    }

    return { color, timeText };
  };

  // Add a refresh button to the error component
  const renderError = () => {
    if (!error) return null;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 2, 
        p: 2 
      }}>
        <Alert 
          severity="error" 
          sx={{ width: '100%' }}
          action={
            <Box>
              <Button 
                color="inherit" 
                size="small"
                onClick={() => {
                  setError('');
                  fetchMessages();
                }}
                sx={{ mr: 1 }}
              >
                Retry
              </Button>
              <Button 
                color="inherit" 
                size="small"
                onClick={() => {
                  setError('');
                  setMessages([]);
                  fetchMessages();
                }}
              >
                Refresh
              </Button>
            </Box>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  };

  // Update the message rendering to include the GitHub link
  const renderMessage = (message, showAvatar = true) => {
    const isCurrentUser = message.sender._id === localStorage.getItem('userId');
    const hasGitHubLink = message.githubLink || (message.attachments && message.attachments.some(att => att.url?.includes('github.com')));
    const hasProjectProgress = message.projectProgress && message.projectProgress.completionPercentage !== undefined;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: isCurrentUser ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          mb: 2,
          px: { xs: 1, sm: 2 },
          opacity: 0,
          transform: isCurrentUser ? 'translateX(20px)' : 'translateX(-20px)',
          animation: 'slideIn 0.3s ease-out forwards',
          '@keyframes slideIn': {
            to: {
              opacity: 1,
              transform: 'translateX(0)'
            }
          }
        }}
      >
        {showAvatar && !isCurrentUser && (
          <Avatar
            src={message.sender.avatar}
            alt={message.sender.name}
            sx={{ 
              width: 40, 
              height: 40, 
              mr: 1,
              boxShadow: 2,
              border: '2px solid',
              borderColor: 'primary.main',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.1)'
              }
            }}
          />
        )}
        <Box sx={{ maxWidth: '70%' }}>
          <Typography
            variant="caption"
            sx={{
              ml: isCurrentUser ? 0 : 1,
              mr: isCurrentUser ? 1 : 0,
              mb: 0.5,
              display: 'block',
              textAlign: isCurrentUser ? 'right' : 'left',
              color: 'text.secondary',
              fontWeight: 500
            }}
          >
            {isCurrentUser ? 'You' : message.sender.name}
          </Typography>
          <Paper
            sx={{
              p: 2,
              bgcolor: isCurrentUser ? 'primary.main' : 'background.paper',
              color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
              borderRadius: isCurrentUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              boxShadow: 3,
              position: 'relative',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="body1" component="div">
                {message.content}
              </Typography>
              {hasGitHubLink && renderGitHubLink(message.content, message.githubLink)}
            </Box>

            {/* Project Progress Section */}
            {hasProjectProgress && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color={isCurrentUser ? 'primary.contrastText' : 'text.secondary'}>
                    Project Progress:
                  </Typography>
                  <Chip
                    label={`${message.projectProgress.completionPercentage}% Complete`}
                    size="small"
                    sx={{
                      bgcolor: isCurrentUser ? 'primary.light' : 'success.main',
                      color: 'white',
                      fontSize: '0.75rem'
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    width: '100%',
                    height: 4,
                    bgcolor: isCurrentUser ? 'primary.light' : 'grey.300',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      width: `${message.projectProgress.completionPercentage}%`,
                      height: '100%',
                      bgcolor: isCurrentUser ? 'primary.contrastText' : 'success.main',
                      transition: 'width 0.5s ease-in-out'
                    }}
                  />
                </Box>
                {message.projectProgress.deadline && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      color: isCurrentUser ? 'primary.contrastText' : 'text.secondary',
                      opacity: 0.8
                    }}
                  >
                    Deadline: {new Date(message.projectProgress.deadline).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            )}

            {/* Message timestamp */}
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 0.5,
                color: isCurrentUser ? 'primary.contrastText' : 'text.secondary',
                opacity: 0.8
              }}
            >
              {new Date(message.createdAt).toLocaleTimeString()}
            </Typography>
          </Paper>
        </Box>
      </Box>
    );
  };

  const handleGitHubClick = (e) => {
    e.preventDefault();
    if (moduleData.githubLink) {
      window.open(moduleData.githubLink, '_blank', 'noopener,noreferrer');
    }
  };

  if (!chat) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Typography color="text.secondary">Select a chat to start messaging</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',
        position: 'relative',
        minHeight: '100%',
        width: '100%',
        maxWidth: '100vw',
        maxHeight: '100vh',
        borderRadius: { xs: 0, sm: 2 },
        boxShadow: { xs: 0, sm: 3 },
        transition: 'all 0.3s ease-in-out'
      }}
    >
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : '#f8f9fa',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          position: 'relative',
          width: '100%',
          zIndex: 2,
          height: { xs: '70px', sm: '80px' },
          minHeight: { xs: '70px', sm: '80px' },
          transition: 'all 0.3s ease-in-out',
          backdropFilter: 'blur(8px)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(8px)',
            zIndex: -1
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 1, sm: 2 },
          flexWrap: 'nowrap',
          overflow: 'hidden',
          flex: 1,
          mr: 2
        }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: { xs: '1rem', sm: '1.25rem' },
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {chat?.project?.name || chat?.title || 'Chat'}
          </Typography>
          {chat?.type === 'project' && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              flexWrap: 'nowrap',
              '@media (min-width: 600px)': {
                gap: 2
              }
            }}>
              {projectDetails?.progressData?.completionPercentage > 0 && (
                <Tooltip title="Project Progress">
                  <Chip
                    label={`${projectDetails.progressData.completionPercentage}%`}
                    size="small"
                    color="primary"
                    variant="filled"
                    sx={{
                      minWidth: '60px',
                      '& .MuiChip-label': {
                        px: 1,
                        fontWeight: 600
                      }
                    }}
                  />
                </Tooltip>
              )}
              {chat.project?.deadline && (
                <Tooltip title={`Deadline: ${format(new Date(chat.project.deadline), 'MMM dd, yyyy')}`}>
                  <Chip
                    icon={<AccessTime sx={{ fontSize: '1rem' }} />}
                    label={getDeadlineInfo(chat.project.deadline)?.timeText}
                    size="small"
                    color={getDeadlineInfo(chat.project.deadline)?.color}
                    variant="outlined"
                    sx={{
                      '& .MuiChip-label': {
                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                      }
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
        {typingUsers.size > 0 && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: { xs: '120px', sm: '200px' }
            }}
          >
            <CircularProgress size={12} />
            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
          </Typography>
        )}
      </Paper>

      {chat.type === 'project' && projectDetails?.deadline && (
        <Alert 
          severity={getDeadlineColor(projectDetails.deadline)}
          sx={{ 
            mx: { xs: 1, sm: 2 }, 
            mt: { xs: 1, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            width: '100%',
            gap: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
              {formatDeadline(projectDetails.deadline)}
            </Box>
            {projectDetails?.progressData?.completionPercentage > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={projectDetails.progressData.completionPercentage}
                  sx={{ 
                    width: '100px',
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'rgba(0, 0, 0, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4
                    }
                  }}
                />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    minWidth: '45px',
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  {projectDetails.progressData.completionPercentage}%
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      )}

      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.default' : '#ffffff',
          backgroundImage: (theme) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          minHeight: 0,
          position: 'relative',
          width: '100%',
          height: '100%',
          maxHeight: 'calc(100vh - 64px - 80px)',
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.2)' 
              : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            transition: 'background 0.2s ease-in-out'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.3)' 
              : 'rgba(0, 0, 0, 0.3)'
          }
        }}
      >
        {renderError()}
        
        {!error && messages.length === 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            color: 'text.secondary',
            px: { xs: 1, sm: 2 }
          }}>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        )}
        
        {!error && messages.length > 0 && (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              minHeight: 'min-content',
              justifyContent: 'flex-start',
              pb: 2,
              px: { xs: 0.5, sm: 1 }
            }}
          >
            {messages.map((message, index) => renderMessage(message, index === 0 || messages[index - 1]?.sender?._id !== message.sender._id))}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
          </Box>
        )}
      </Box>

      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          borderTop: '1px solid', 
          borderColor: 'divider',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : '#f8f9fa',
          flexShrink: 0,
          position: 'relative',
          width: '100%',
          zIndex: 2,
          height: { xs: '80px', sm: '90px' },
          minHeight: { xs: '80px', sm: '90px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transition: 'all 0.3s ease-in-out',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Box 
          component="form" 
          onSubmit={handleSendMessage} 
          sx={{ 
            display: 'flex', 
            gap: { xs: 1, sm: 2 },
            alignItems: 'center'
          }}
        >
          <IconButton
            color="primary"
            onClick={handleModuleDialogOpen}
            size="medium"
            sx={{ 
              bgcolor: 'background.default',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { 
                bgcolor: 'action.hover',
                transform: 'scale(1.1)'
              }
            }}
          >
            <Assignment />
          </IconButton>
          <TextField
            fullWidth
            size="medium"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            variant="outlined"
            sx={{ 
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.default',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&.Mui-focused': {
                  bgcolor: 'background.paper',
                  boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`
                }
              }
            }}
          />
          <IconButton
            color="primary"
            type="submit"
            disabled={!newMessage.trim() || isSending}
            size="medium"
            sx={{ 
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { 
                bgcolor: 'primary.dark',
                transform: 'scale(1.1)'
              },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled'
              }
            }}
          >
            <Send />
          </IconButton>
        </Box>
      </Paper>

      <Menu
        anchorEl={uploadAnchorEl}
        open={Boolean(uploadAnchorEl)}
        onClose={handleUploadClose}
      >
        <MenuItem onClick={() => {
          fileInputRef.current.click();
          fileInputRef.current.accept = "image/*";
          fileInputRef.current.setAttribute('data-type', 'image');
          handleUploadClose();
        }}>
          <ListItemIcon>
            <Image fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Upload Image" secondary="Share screenshots or photos" />
        </MenuItem>
        <MenuItem onClick={() => {
          fileInputRef.current.click();
          fileInputRef.current.accept = ".pdf,.doc,.docx,.txt,.js,.jsx,.ts,.tsx,.json,.html,.css";
          fileInputRef.current.setAttribute('data-type', 'file');
          handleUploadClose();
        }}>
          <ListItemIcon>
            <Description fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Upload File" secondary="Share documents or code files" />
        </MenuItem>
        {chat.type === 'project' && (
          <MenuItem onClick={handleModuleDialogOpen}>
            <ListItemIcon>
              <Assignment fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Submit Module" secondary="Submit project progress with files" />
          </MenuItem>
        )}
      </Menu>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e, fileInputRef.current.getAttribute('data-type'))}
        multiple
      />

      <Dialog
        open={moduleDialogOpen}
        onClose={() => {
          setModuleDialogOpen(false);
          setError('');
        }}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 500 }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" component="div">
                Update Module Progress
              </Typography>
              {projectDetails?.name && (
                <Typography variant="subtitle2" color="text.secondary">
                  Project: {projectDetails.name}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={() => {
                setModuleDialogOpen(false);
                setError('');
              }}
              size="small"
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <TextField
              label="Module Title"
              fullWidth
              required
              value={moduleData.title}
              onChange={(e) => setModuleData(prev => ({ ...prev, title: e.target.value }))}
              error={moduleData.title?.trim() === ''}
              helperText={moduleData.title?.trim() === '' ? 'Title is required' : ''}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={moduleData.description}
              onChange={(e) => setModuleData(prev => ({ ...prev, description: e.target.value }))}
            />
            <TextField
              label="Completion Percentage"
              type="number"
              fullWidth
              required
              value={moduleData.completionPercentage}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setModuleData(prev => ({ 
                  ...prev, 
                  completionPercentage: Math.min(100, Math.max(0, value))
                }));
              }}
              inputProps={{ min: 0, max: 100 }}
              error={!moduleData.completionPercentage}
              helperText={!moduleData.completionPercentage ? 'Completion percentage is required' : ''}
            />
            <TextField
              label="GitHub Repository Link"
              fullWidth
              value={moduleData.githubLink}
              onChange={(e) => setModuleData(prev => ({ ...prev, githubLink: e.target.value }))}
              helperText="Enter the GitHub repository URL"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setModuleDialogOpen(false);
            setError('');
            setModuleData({
              title: '',
              description: '',
              completionPercentage: 0,
              githubLink: ''
            });
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleModuleSubmit}
            variant="contained"
            disabled={!isModuleDataValid()}
          >
            Update Progress
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ChatWindow; 