import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Button,
  Chip,
  useTheme,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
} from '@mui/material';
import {
  Person,
  Code,
  GitHub,
  Language,
  Description,
  Edit,
  LinkedIn,
  Email,
  Delete,
  Chat as ChatIcon,
  Badge as BadgeIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import storage from '../utils/storage';
import ProjectDialog from './ProjectDialog';
import JoinProjectsDialog from './JoinProjectsDialog';
import ProjectRequestsDialog from './ProjectRequestsDialog';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'success' });
  const [joinProjectsDialogOpen, setJoinProjectsDialogOpen] = useState(false);
  const [projectRequestsDialogOpen, setProjectRequestsDialogOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const navigate = useNavigate();
  const theme = useTheme();

  const showAlert = (message, severity = 'success') => {
    setAlert({ open: true, message, severity });
  };

  const handleCloseAlert = () => {
    setAlert(prev => ({ ...prev, open: false }));
  };

  // Validate API URL
  const validateAndGetApiUrl = (endpoint) => {
    // Log all relevant environment variables
    console.log('Environment Variables:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
    });

    // Check both possible environment variable names
    const baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
    
    if (!baseUrl) {
      console.error('API base URL is not configured. Environment variables are not loaded correctly.');
      console.error('Please check:');
      console.error('1. .env file exists in the frontend directory');
      console.error('2. Environment variable is named either VITE_API_URL or VITE_API_BASE_URL');
      console.error('3. Vite server was restarted after updating .env');
      throw new Error('API base URL is not configured. Please check your .env file and restart the dev server.');
    }

    // Remove trailing slash from base URL if it exists
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    // Add leading slash to endpoint if it doesn't exist
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const fullUrl = `${cleanBaseUrl}${cleanEndpoint}`;
    console.log('Base URL:', cleanBaseUrl);
    console.log('Endpoint:', cleanEndpoint);
    console.log('Full API URL:', fullUrl);
    
    return fullUrl;
  };

  // Validate auth token
  const getAuthHeaders = () => {
    const token = storage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }
    console.log('Auth token present:', !!token);
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  };

  // Fetch user data including projects
  const fetchUserData = async () => {
    try {
      // Validate API URL and get auth headers
      const apiUrl = validateAndGetApiUrl('/api/auth/profile');
      const headers = getAuthHeaders();
      
      console.log('Fetching user data from:', apiUrl);
      console.log('Request headers:', {
        ...headers,
        'Authorization': 'Bearer [REDACTED]' // Hide actual token in logs
      });

      const response = await fetch(apiUrl, { headers });

      // Log response details
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.status === 404) {
        throw new Error('API endpoint not found. Please check the URL and server configuration.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || 'Failed to fetch user data');
        } catch (e) {
          throw new Error(`Server Error (${response.status}): ${errorText}`);
        }
      }

      const responseText = await response.text();
      console.log('Response received, length:', responseText.length);

      let userData;
      try {
        userData = JSON.parse(responseText);
        console.log('User data parsed successfully');
      } catch (e) {
        console.error('JSON Parse Error:', e);
        console.error('Invalid JSON:', responseText);
        throw new Error('Invalid JSON response from server');
      }

      setUser(userData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      showAlert(error.message || 'Error fetching user data', 'error');
      if (error.message.includes('token') || error.message.includes('auth') || error.status === 401) {
        storage.clearAuth();
        navigate('/login');
      }
    }
  };

  // Add this function to fetch pending requests
  const fetchPendingRequests = async () => {
    try {
      const apiUrl = validateAndGetApiUrl('/api/projects/requests/count');
      const headers = getAuthHeaders();
      
      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending requests count');
      }

      const { count } = await response.json();
      setPendingRequests(new Array(count).fill(null));
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  // Update useEffect to include fetching pending requests
  useEffect(() => {
    fetchUserData();
    fetchPendingRequests();
  }, []);

  const handleLogout = () => {
    storage.clearAuth();
    navigate('/login');
  };

  const handleAddProject = () => {
    setSelectedProject(null);
    setProjectDialogOpen(true);
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setProjectDialogOpen(true);
  };

  const handleSaveProject = async (projectData) => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/projects${selectedProject ? `/${selectedProject._id}` : ''}`;
      const token = storage.getToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Ensure the deadline is properly formatted
      const formattedData = {
        ...projectData,
        deadline: new Date(projectData.deadline).toISOString()
      };

      const response = await fetch(apiUrl, {
        method: selectedProject ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(formattedData),
      });

      if (response.status === 404) {
        throw new Error('Project API endpoint not found. Please check the server configuration.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || 'Failed to save project');
        } catch (e) {
          throw new Error(`Server Error (${response.status}): ${errorText}`);
        }
      }

      const responseText = await response.text();
      console.log('Response received, length:', responseText.length);

      let updatedProject;
      try {
        updatedProject = JSON.parse(responseText);
        console.log('Project data parsed successfully');
      } catch (e) {
        console.error('JSON Parse Error:', e);
        console.error('Invalid JSON:', responseText);
        throw new Error('Invalid JSON response from server');
      }
      
      // Update local user state with the new project
      setUser(prevUser => {
        const projects = prevUser.projects || [];
        if (selectedProject) {
          const updatedProjects = projects.map(p => 
            p._id === selectedProject._id ? updatedProject : p
          );
          return { ...prevUser, projects: updatedProjects };
        } else {
          return { ...prevUser, projects: [...projects, updatedProject] };
        }
      });

      showAlert(selectedProject ? 'Project updated successfully' : 'Project added successfully');
      setProjectDialogOpen(false);
    } catch (error) {
      console.error('Error in handleSaveProject:', error);
      showAlert(error.message || 'Error saving project', 'error');
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      const apiUrl = validateAndGetApiUrl(`/api/projects/${projectId}`);
      const headers = getAuthHeaders();

      console.log('Deleting project from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers
      });

      if (response.status === 404) {
        throw new Error('Project not found or already deleted');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete project: ${errorText}`);
      }

      // Update local state
      setUser(prevUser => ({
        ...prevUser,
        projects: prevUser.projects.filter(p => p._id !== projectId)
      }));

      showAlert('Project deleted successfully');
    } catch (error) {
      console.error('Error in handleDeleteProject:', error);
      showAlert(error.message || 'Error deleting project', 'error');
    }
  };

  const handleUpdateProfile = async (field, value) => {
    try {
      const token = storage.getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const { user: updatedUser } = await response.json();
      setUser(updatedUser);
      showAlert('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Error updating profile', 'error');
    }
  };

  // Add these functions to handle project requests
  const handleRequestJoin = async (projectId, openingId, message) => {
    try {
      const apiUrl = validateAndGetApiUrl('/api/projects/request');
      const headers = getAuthHeaders();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, openingId, message }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send join request');
      }

      showAlert('Join request sent successfully');
    } catch (error) {
      console.error('Error sending join request:', error);
      showAlert(error.message, 'error');
      throw error; // Re-throw to handle in the dialog
    }
  };

  const handleAcceptRequest = async (requestId, projectId, openingId) => {
    try {
      const apiUrl = validateAndGetApiUrl(`/api/projects/requests/${requestId}/accept`);
      const headers = getAuthHeaders();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ projectId, openingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to accept request');
      }

      showAlert('Request accepted successfully');
      fetchPendingRequests(); // Refresh the requests count
    } catch (error) {
      console.error('Error accepting request:', error);
      showAlert(error.message, 'error');
      throw error;
    }
  };

  const handleRejectRequest = async (requestId, projectId, openingId) => {
    try {
      const apiUrl = validateAndGetApiUrl(`/api/projects/requests/${requestId}/reject`);
      const headers = getAuthHeaders();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, openingId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reject request');
      }

      showAlert('Request rejected successfully');
      fetchPendingRequests(); // Refresh the requests count
    } catch (error) {
      console.error('Error rejecting request:', error);
      showAlert(error.message, 'error');
      throw error;
    }
  };

  if (isLoading) {
    return (
      <Container>
        <Typography variant="h5" sx={{ mt: 4 }}>
          Loading...
        </Typography>
      </Container>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header Section */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Profile Dashboard
          </Typography>
          <Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<ChatIcon />}
              onClick={() => navigate('/chat')}
              sx={{ mr: 2 }}
            >
              Chat
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<GroupsIcon />}
              onClick={() => navigate('/communities')}
              sx={{ mr: 2 }}
            >
              Communities
            </Button>
            <Button variant="outlined" color="primary" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Left Column - Profile Info */}
          <Grid item xs={12} md={4}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                borderRadius: 2,
                boxShadow: theme.shadows[1],
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Profile Header */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                mb: 3,
                position: 'relative'
              }}>
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '3rem',
                    mb: 2,
                    boxShadow: theme.shadows[3],
                  }}
                >
                  {user.name ? user.name[0].toUpperCase() : '?'}
                </Avatar>
                <IconButton 
                  sx={{ 
                    position: 'absolute',
                    right: 0,
                    top: 0,
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {user.name || 'Unknown User'}
                </Typography>
                <Typography 
                  variant="subtitle1" 
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  @{user.username || 'unknown'}
                </Typography>
                <Chip 
                  label={user.experienceLevel || 'Experience Level'} 
                  color="primary" 
                  variant="outlined"
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Contact & Links */}
              <List sx={{ py: 0 }}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <GitHub color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="GitHub Profile"
                    secondary={user.githubProfile || 'Not added yet'}
                    secondaryTypographyProps={{
                      sx: { 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: user.githubProfile ? 'primary.main' : 'text.secondary'
                      }
                    }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <Language color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Portfolio"
                    secondary={user.portfolio || 'Not added yet'}
                    secondaryTypographyProps={{
                      sx: { 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: user.portfolio ? 'primary.main' : 'text.secondary'
                      }
                    }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon>
                    <LinkedIn color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="LinkedIn"
                    secondary={user.linkedin || 'Not added yet'}
                    secondaryTypographyProps={{
                      sx: { 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: user.linkedin ? 'primary.main' : 'text.secondary'
                      }
                    }}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          {/* Right Column - Skills, Bio & Projects */}
          <Grid item xs={12} md={8}>
            {/* Skills Section */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                mb: 3, 
                borderRadius: 2,
                boxShadow: theme.shadows[1]
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Code sx={{ mr: 1 }} /> Skills
                </Typography>
                <IconButton size="small">
                  <Edit fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {user.skills && Array.isArray(user.skills) && user.skills.length > 0 ? (
                  user.skills.map((skill, index) => (
                    <Chip
                      key={index}
                      label={skill}
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.main',
                        },
                      }}
                    />
                  ))
                ) : (
                  <Typography color="text.secondary">No skills added yet</Typography>
                )}
              </Box>
            </Paper>

            {/* Bio Section */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3,
                mb: 3,
                borderRadius: 2,
                boxShadow: theme.shadows[1]
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2
              }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                  <Description sx={{ mr: 1 }} /> Bio
                </Typography>
                <IconButton size="small">
                  <Edit fontSize="small" />
                </IconButton>
              </Box>
              <Typography
                sx={{
                  color: user.bio ? 'text.primary' : 'text.secondary',
                  lineHeight: 1.8,
                }}
              >
                {user.bio || 'No bio added yet. Tell others about yourself!'}
              </Typography>
            </Paper>

            {/* Project Collaborations Section */}
            <Paper
  elevation={3}
  sx={{
    p: 4,
    borderRadius: 3,
    boxShadow: theme.shadows[3],
    bgcolor: 'background.paper'
  }}
>
  {/* Header Section */}
  <Box 
    sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      mb: 2
    }}
  >
    <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
      <Code sx={{ mr: 1, color: 'primary.main' }} /> Project Collaborations
    </Typography>

    {/* Buttons Section */}
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Button
        variant="contained"
        size="medium"
        color="primary"
        startIcon={<Edit />}
        onClick={handleAddProject}
        sx={{ 
          borderRadius: 2, 
          textTransform: 'none', 
          fontWeight: 'bold', 
          px: 3
        }}
      >
        Create Project
      </Button>

      <Button
        variant="outlined"
        size="medium"
        color="primary"
        onClick={() => setJoinProjectsDialogOpen(true)}
        sx={{ 
          borderRadius: 2, 
          textTransform: 'none', 
          fontWeight: 'bold', 
          px: 3,
          borderWidth: 2
        }}
      >
        Join Projects
      </Button>

      <Button
        variant="outlined"
        size="medium"
        color="error"
        onClick={() => setProjectRequestsDialogOpen(true)}
        startIcon={<Badge badgeContent={pendingRequests.length} color="error" />}
        sx={{ 
          borderRadius: 2, 
          textTransform: 'none', 
          fontWeight: 'bold', 
          px: 3,
          borderWidth: 2
        }}
      >
        Project Requests
      </Button>
    </Box>
  </Box>

  {/* Empty State Message */}
  <Box 
    sx={{ 
      textAlign: 'center',
      py: 6,
      px: 3,
      bgcolor: 'background.default',
      borderRadius: 2,
      border: '1px dashed',
      borderColor: 'divider',
      mt: 3
    }}
  >
    <Typography variant="h6" color="text.secondary">
      No projects available. Start by creating one!
    </Typography>
  </Box>
</Paper>



          </Grid>
        </Grid>
      </Container>

      {/* Project Dialog */}
      <ProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        project={selectedProject}
        onSave={handleSaveProject}
      />

      {/* Alert Snackbar */}
      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseAlert}
          severity={alert.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>

      {/* Add these dialogs at the end of the return statement */}
      <JoinProjectsDialog
        open={joinProjectsDialogOpen}
        onClose={() => setJoinProjectsDialogOpen(false)}
        onRequestJoin={handleRequestJoin}
      />
      
      <ProjectRequestsDialog
        open={projectRequestsDialogOpen}
        onClose={() => setProjectRequestsDialogOpen(false)}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />
    </Box>
  );
};

export default Dashboard; 