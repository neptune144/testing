import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Person, Code } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ProjectRequestsDialog = ({ open, onClose, onAccept, onReject }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      fetchProjectRequests();
    }
  }, [open]);

  const fetchProjectRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project requests');
      }

      const data = await response.json();
      
      console.log('Raw API response:', data); // Debug log
      
      // Transform the data to match our component's expected structure
      const transformedRequests = data.map(request => {
        // Handle different possible property names
        const projectId = request.projectId || request.projectld || request.project_id;
        const openingId = request.openingId || request.openingld || request.opening_id;
        const projectName = request.projectName || request.project_name;
        const role = request.role;
        const applicant = request.applicant || {};

        // Debug log for each request
        console.log('Processing request:', {
          original: request,
          extracted: { projectId, openingId, projectName, role, applicant }
        });

        // Skip invalid requests
        if (!projectId || !openingId) {
          console.warn('Missing required fields:', request);
          return null;
        }

        return {
          _id: request.requestId || request.request_id || `${projectId}-${openingId}`,
          project: {
            _id: projectId,
            name: projectName || 'Unknown Project'
          },
          opening: {
            _id: openingId,
            role: role || 'Unknown Position'
          },
          user: {
            name: applicant?.name || 'Unknown User',
            username: applicant?.username || '',
            skills: Array.isArray(applicant?.skills) ? applicant.skills : []
          },
          message: request.message || ''
        };
      });
      
      // Filter out null values and validate the transformed data
      const validRequests = transformedRequests
        .filter(Boolean) // Remove null values
        .filter(request => {
          const isValid = 
            request._id &&
            request.project?._id &&
            request.opening?._id;
          
          if (!isValid) {
            console.warn('Invalid request data after transformation:', request);
          }
          return isValid;
        });
      
      console.log('Transformed and validated requests:', validRequests); // Debug log
      
      setRequests(validRequests);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId, projectId, openingId) => {
    try {
      await onAccept(requestId, projectId, openingId);
      // Update local state to remove the accepted request
      setRequests(prevRequests => 
        prevRequests.filter(request => request._id !== requestId)
      );
      
      // Navigate to chat after successful acceptance
      navigate('/chat');
      onClose(); // Close the dialog
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (requestId, projectId, openingId) => {
    try {
      await onReject(requestId, projectId, openingId);
      // Update local state to remove the rejected request
      setRequests(prevRequests => 
        prevRequests.filter(request => request._id !== requestId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Project Join Requests</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        ) : requests.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>No pending requests at the moment.</Alert>
        ) : (
          <Box sx={{ mt: 2 }}>
            {requests.map((request) => (
              <Card key={request._id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ mr: 2 }}>
                      {request?.user?.name?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1">
                        {request?.user?.name || 'Unknown User'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {request?.user?.username ? `@${request.user.username}` : ''}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" gutterBottom>
                    Project: {request?.project?.name || 'Unknown Project'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Position: {request?.opening?.role || 'Unknown Position'}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      <Code sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Applicant Skills:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {request?.user?.skills?.length > 0 ? (
                        request.user.skills.map((skill, index) => (
                          <Chip key={index} label={skill} size="small" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No skills listed
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {request.message && (
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      Message: {request.message}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={() => handleAccept(request._id, request.project._id, request.opening._id)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleReject(request._id, request.project._id, request.opening._id)}
                  >
                    Reject
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectRequestsDialog; 