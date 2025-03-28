import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Modal,
  TextField,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';

const Communities = () => {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [newCommunity, setNewCommunity] = useState({ name: '', description: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  // Fetch communities on component mount
  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      const response = await fetch('/api/communities');
      if (!response.ok) throw new Error('Failed to fetch communities');
      const data = await response.json();
      setCommunities(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/create-community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCommunity),
      });

      if (!response.ok) throw new Error('Failed to create community');
      
      const createdCommunity = await response.json();
      setCommunities(prev => [...prev, createdCommunity]);
      setCreateModalOpen(false);
      setNewCommunity({ name: '', description: '' });
      setSnackbar({
        open: true,
        message: 'Community created successfully!',
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.message,
        severity: 'error'
      });
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      const response = await fetch(`/api/communities/${communityId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) throw new Error('Failed to join community');
      
      const updatedCommunity = await response.json();
      setCommunities(prev => 
        prev.map(comm => comm._id === communityId ? updatedCommunity : comm)
      );
      setJoinModalOpen(false);
      setSnackbar({
        open: true,
        message: 'Successfully joined the community!',
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.message,
        severity: 'error'
      });
    }
  };

  const navigateToCommunity = (communityId) => {
    navigate(`/communities/${communityId}`);
  };

  if (loading) return <Box display="flex" justifyContent="center" m={4}><CircularProgress /></Box>;
  if (error) return <Typography color="error" m={4}>{error}</Typography>;

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" mb={4}>
        <Typography variant="h4" component="h1">Communities</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateModalOpen(true)}
            sx={{ mr: 2 }}
          >
            Create Community
          </Button>
          <Button
            variant="outlined"
            startIcon={<GroupAddIcon />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join Community
          </Button>
        </Box>
      </Box>

      {communities.length === 0 ? (
        <Typography variant="h6" textAlign="center" mt={4}>
          No communities available. Create one!
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {communities.map((community) => (
            <Grid item xs={12} sm={6} md={4} key={community._id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 6 }
                }}
                onClick={() => navigateToCommunity(community._id)}
              >
                <CardContent>
                  <Typography variant="h6">{community.name}</Typography>
                  <Typography color="textSecondary" sx={{ mb: 2 }}>
                    {community.description}
                  </Typography>
                  <Typography variant="body2">
                    Members: {community.members?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Community Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)}>
        <form onSubmit={handleCreateCommunity}>
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
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Join Community Modal */}
      <Dialog open={joinModalOpen} onClose={() => setJoinModalOpen(false)}>
        <DialogTitle>Join Community</DialogTitle>
        <DialogContent>
          <List>
            {communities
              .filter(community => !community.members?.includes(localStorage.getItem('userId')))
              .map((community) => (
                <ListItem
                  key={community._id}
                  secondaryAction={
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleJoinCommunity(community._id)}
                    >
                      Join
                    </Button>
                  }
                >
                  <ListItemText
                    primary={community.name}
                    secondary={community.description}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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

export default Communities; 