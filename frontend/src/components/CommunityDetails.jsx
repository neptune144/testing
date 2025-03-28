import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Divider,
  Snackbar
} from '@mui/material';
import {
  Event as EventIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  VideoCall as VideoCallIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';

const CommunityDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [message, setMessage] = useState('');
  const [openWebinarDialog, setOpenWebinarDialog] = useState(false);
  const [newWebinar, setNewWebinar] = useState({
    name: '',
    description: '',
    meetingLink: '',
    scheduledFor: ''
  });
  const [messages, setMessages] = useState([]);
  const [webinars, setWebinars] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchCommunityDetails();
    fetchMessages();
    fetchWebinars();
  }, [id]);

  useEffect(() => {
    if (activeTab === 1) {
      scrollToBottom();
    }
  }, [community?.messages, activeTab]);

  const fetchCommunityDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/communities/${id}`);
      setCommunity(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch community details. Please try again later.');
      console.error('Error fetching community details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`/api/communities/${id}/messages`);
      setMessages(response.data);
    } catch (err) {
      setError('Failed to fetch messages. Please try again later.');
      console.error('Error fetching messages:', err);
    }
  };

  const fetchWebinars = async () => {
    try {
      const response = await axios.get(`/api/communities/${id}/webinars`);
      setWebinars(response.data);
    } catch (err) {
      setError('Failed to fetch webinars. Please try again later.');
      console.error('Error fetching webinars:', err);
    }
  };

  const handleSendMessage = async (projectData = null) => {
    if (!message.trim() && !projectData) return;

    try {
      const messageData = {
        content: message
      };

      // If project completion data is provided, include it in the message
      if (projectData) {
        messageData.projectProgress = {
          completionPercentage: projectData.completionPercentage,
          projectId: projectData.projectId,
          deadline: projectData.deadline
        };
      }

      const response = await axios.post(`/api/communities/${id}/messages`, messageData);

      setCommunity(prev => ({
        ...prev,
        messages: [...prev.messages, response.data]
      }));
      setMessage('');
    } catch (err) {
      setError('Failed to send message. Please try again.');
      console.error('Error sending message:', err);
    }
  };

  const handleCreateWebinar = async () => {
    try {
      const response = await axios.post(`/api/communities/${id}/webinars`, newWebinar);

      setCommunity(prev => ({
        ...prev,
        webinars: [...prev.webinars, response.data]
      }));
      setOpenWebinarDialog(false);
      setNewWebinar({
        name: '',
        description: '',
        meetingLink: '',
        scheduledFor: ''
      });
      setSnackbar({
        open: true,
        message: 'Webinar created successfully!',
        severity: 'success'
      });
    } catch (err) {
      setError('Failed to create webinar. Please try again.');
      console.error('Error creating webinar:', err);
    }
  };

  const handleDeleteWebinar = async (webinarId) => {
    try {
      await axios.delete(`/api/communities/${id}/webinars/${webinarId}`);
      setCommunity(prev => ({
        ...prev,
        webinars: prev.webinars.filter(webinar => webinar._id !== webinarId)
      }));
      setSnackbar({
        open: true,
        message: 'Webinar deleted successfully!',
        severity: 'success'
      });
    } catch (err) {
      setError('Failed to delete webinar. Please try again.');
      console.error('Error deleting webinar:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!community) {
    return (
      <Box p={3}>
        <Alert severity="error">Community not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              {community.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {community.description}
            </Typography>
            <Box sx={{ mb: 2 }}>
              {community.tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              ))}
            </Box>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate('/communities')}
          >
            Back to Communities
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Webinars" />
            <Tab label="Messages" />
            <Tab label="Members" />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenWebinarDialog(true)}
                >
                  Schedule Webinar
                </Button>
              </Box>
              <Grid container spacing={2}>
                {community.webinars.map(webinar => (
                  <Grid item xs={12} md={6} key={webinar._id}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        {webinar.name}
                      </Typography>
                      <Typography variant="body2" paragraph>
                        {webinar.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <EventIcon sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="body2">
                          {format(new Date(webinar.scheduledFor), 'PPp')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          href={webinar.meetingLink}
                          target="_blank"
                        >
                          Join Meeting
                        </Button>
                        {(community.isAdmin(localStorage.getItem('userId')) ||
                          webinar.creator._id === localStorage.getItem('userId')) && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleDeleteWebinar(webinar._id)}
                          >
                            Delete
                          </Button>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <List sx={{ height: '400px', overflowY: 'auto', mb: 2 }}>
                {messages.map((msg, index) => (
                  <ListItem key={msg._id} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar alt={msg.sender.name} src={msg.sender.avatar} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography component="span" variant="subtitle2">
                          {msg.sender.name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.primary"
                            sx={{ display: 'block' }}
                          >
                            {msg.content}
                          </Typography>
                          {msg.projectProgress && (
                            <Box sx={{ mt: 1, mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Project: {msg.projectProgress.projectId.name}
                                </Typography>
                                <Chip
                                  label={`${msg.projectProgress.completionPercentage}% Complete`}
                                  size="small"
                                  color="primary"
                                  sx={{
                                    backgroundColor: '#4caf50',
                                    color: 'white',
                                  }}
                                />
                              </Box>
                              <Box
                                sx={{
                                  mt: 0.5,
                                  width: '100%',
                                  height: 4,
                                  backgroundColor: '#e0e0e0',
                                  borderRadius: 2,
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    width: `${msg.projectProgress.completionPercentage}%`,
                                    height: '100%',
                                    backgroundColor: '#4caf50',
                                    borderRadius: 2,
                                    transition: 'width 0.5s ease-in-out'
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Project Completion: {msg.projectProgress.completionPercentage}%
                                </Typography>
                                {msg.projectProgress.deadline && (
                                  <Typography variant="caption" color="text.secondary">
                                    Deadline: {format(new Date(msg.projectProgress.deadline), 'PPp')}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            {format(new Date(msg.createdAt), 'PPp')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                <div ref={messagesEndRef} />
              </List>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  endIcon={<SendIcon />}
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                >
                  Send
                </Button>
              </Box>
            </Box>
          )}

          {activeTab === 2 && (
            <List>
              {community.members.map(member => (
                <ListItem key={member.user._id}>
                  <ListItemAvatar>
                    <Avatar alt={member.user.name} src={member.user.avatar} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.user.name}
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                      >
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Paper>

      <Dialog open={openWebinarDialog} onClose={() => setOpenWebinarDialog(false)}>
        <DialogTitle>Schedule New Webinar</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Webinar Name"
            fullWidth
            value={newWebinar.name}
            onChange={(e) =>
              setNewWebinar(prev => ({ ...prev, name: e.target.value }))
            }
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newWebinar.description}
            onChange={(e) =>
              setNewWebinar(prev => ({ ...prev, description: e.target.value }))
            }
          />
          <TextField
            margin="dense"
            label="Meeting Link"
            fullWidth
            value={newWebinar.meetingLink}
            onChange={(e) =>
              setNewWebinar(prev => ({ ...prev, meetingLink: e.target.value }))
            }
          />
          <TextField
            margin="dense"
            label="Scheduled For"
            type="datetime-local"
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            value={newWebinar.scheduledFor}
            onChange={(e) =>
              setNewWebinar(prev => ({ ...prev, scheduledFor: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWebinarDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateWebinar}
            variant="contained"
            disabled={
              !newWebinar.name ||
              !newWebinar.description ||
              !newWebinar.meetingLink ||
              !newWebinar.scheduledFor
            }
          >
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CommunityDetails; 