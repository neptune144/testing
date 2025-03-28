import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  People as PeopleIcon,
  Event as EventIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add this outside the component to maintain a counter across renders
let tempIdCounter = 0;
const generateUniqueKey = (prefix = 'temp') => {
  tempIdCounter += 1;
  return `${prefix}-${Date.now()}-${tempIdCounter}`;
};

const CommunityList = () => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    isPrivate: false,
    tags: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      setIsAuthenticated(!!token && !!userId);
    };

    checkAuth();
    fetchCommunities();
  }, []);

  const fetchCommunities = async (searchQuery = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/communities${searchQuery ? `?search=${searchQuery}` : ''}`);
      
      if (!response.data) {
        throw new Error('No data received from server');
      }

      if (Array.isArray(response.data)) {
        setCommunities(response.data);
      } else if (response.data.communities && Array.isArray(response.data.communities)) {
        setCommunities(response.data.communities);
      } else {
        console.error('Invalid response format:', response.data);
        throw new Error('Invalid data format received from server');
      }
    } catch (err) {
      console.error('Error fetching communities:', err);
      if (err.response) {
        // Server responded with error
        setError(err.response.data?.message || 'Failed to fetch communities');
      } else if (err.request) {
        // Request made but no response
        setError('Unable to reach the server. Please check your connection.');
      } else {
        // Other errors
        setError(err.message || 'Failed to fetch communities. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    fetchCommunities(value);
  };

  const handleCreateCommunity = async () => {
    try {
      if (!newCommunity.name.trim()) {
        setError('Community name is required');
        return;
      }

      const tagsArray = newCommunity.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);

      const response = await api.post('/api/create-community', {
        ...newCommunity,
        tags: tagsArray
      });

      setCommunities(prev => [response.data, ...prev]);
      setOpenCreateDialog(false);
      setNewCommunity({
        name: '',
        description: '',
        isPrivate: false,
        tags: ''
      });
      setError(null);
    } catch (err) {
      console.error('Error creating community:', err);
      setError(err.response?.data?.message || 'Failed to create community. Please try again.');
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      if (!communityId) {
        throw new Error('Invalid community ID');
      }

      console.log('Attempting to join community:', communityId); // Debug log

      const response = await api.post(`/api/community/${communityId}/join`, {
        userId: localStorage.getItem('userId')
      });
      
      if (!response.data) {
        throw new Error('No response data received');
      }

      console.log('Join response:', response.data); // Debug log

      // Update the communities list with the joined community
      setCommunities(prev =>
        prev.map(community =>
          community._id === communityId 
            ? { ...community, members: [...(community.members || []), { _id: localStorage.getItem('userId') }] }
            : community
        )
      );
      setError(null);
    } catch (err) {
      console.error('Error joining community:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to join community. Please try again.';
      setError(errorMessage);
    }
  };

  const handleLeaveCommunity = async (communityId) => {
    try {
      if (!communityId) {
        throw new Error('Invalid community ID');
      }

      console.log('Attempting to leave community:', communityId); // Debug log

      await api.post(`/api/community/${communityId}/leave`, {
        userId: localStorage.getItem('userId')
      });

      // Update the communities list by removing the user from members
      setCommunities(prev =>
        prev.map(community =>
          community._id === communityId
            ? {
                ...community,
                members: (community.members || []).filter(
                  member => member._id !== localStorage.getItem('userId')
                )
              }
            : community
        )
      );
      setError(null);
    } catch (err) {
      console.error('Error leaving community:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to leave community. Please try again.';
      setError(errorMessage);
    }
  };

  const renderActionButtons = (community) => {
    if (!isAuthenticated) {
      return (
        <Button
          size="small"
          color="primary"
          onClick={() => navigate('/login')}
        >
          Login to Join
        </Button>
      );
    }

    const userId = localStorage.getItem('userId');
    const isMember = community.members?.some(member => 
      member._id === userId || member === userId
    );

    console.log('Community:', community); // Debug log
    console.log('User ID:', userId); // Debug log
    console.log('Is member:', isMember); // Debug log

    return (
      <>
        {isMember ? (
          <Button
            size="small"
            color="error"
            onClick={() => handleLeaveCommunity(community._id)}
          >
            Leave
          </Button>
        ) : (
          <Button
            size="small"
            color="primary"
            onClick={() => handleJoinCommunity(community._id)}
          >
            Join
          </Button>
        )}
        <Button
          size="small"
          color="primary"
          onClick={() => {
            console.log('Navigating to community:', community._id);
            navigate(`/community/${community._id}`);
          }}
        >
          View Details
        </Button>
      </>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextField
          placeholder="Search communities..."
          variant="outlined"
          size="small"
          value={search}
          onChange={handleSearch}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          sx={{ width: '300px' }}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Community
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {Array.isArray(communities) && communities.length > 0 ? (
          communities.map((community, index) => (
            <Grid item xs={12} sm={6} md={4} key={community._id || generateUniqueKey('community')}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {community.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {community.description}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {Array.isArray(community.tags) && community.tags.map((tag, tagIndex) => (
                      <Chip
                        key={`${community._id || generateUniqueKey('tag')}-${tagIndex}`}
                        label={tag}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PeopleIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2">
                      {Array.isArray(community.members) ? community.members.length : 0} members
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <EventIcon sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2">
                      {Array.isArray(community.webinars) ? community.webinars.length : 0} webinars
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  {community._id && renderActionButtons(community)}
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Typography variant="h6" textAlign="center" color="text.secondary">
              No communities available. Create one to get started!
            </Typography>
          </Grid>
        )}
      </Grid>

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle>Create New Community</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Community Name"
            fullWidth
            required
            value={newCommunity.name}
            onChange={(e) => setNewCommunity(prev => ({ ...prev, name: e.target.value }))}
            error={!newCommunity.name.trim() && newCommunity.name !== ''}
            helperText={!newCommunity.name.trim() && newCommunity.name !== '' ? 'Community name is required' : ''}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={newCommunity.description}
            onChange={(e) => setNewCommunity(prev => ({ ...prev, description: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Tags (comma-separated)"
            fullWidth
            value={newCommunity.tags}
            onChange={(e) => setNewCommunity(prev => ({ ...prev, tags: e.target.value }))}
            helperText="Enter tags separated by commas (e.g., programming, web development, react)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={newCommunity.isPrivate}
                onChange={(e) => setNewCommunity(prev => ({ ...prev, isPrivate: e.target.checked }))}
              />
            }
            label="Private Community"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateCommunity} 
            variant="contained" 
            color="primary"
            disabled={!newCommunity.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CommunityList; 