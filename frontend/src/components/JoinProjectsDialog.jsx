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
  Chip,
  CircularProgress,
  Alert,
  TextField,
} from '@mui/material';
import { Person, Code } from '@mui/icons-material';

const JoinProjectsDialog = ({ open, onClose, onRequestJoin }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedOpening, setSelectedOpening] = useState(null);

  useEffect(() => {
    if (open) {
      fetchAvailableProjects();
    }
  }, [open]);

  const fetchAvailableProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/available`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available projects');
      }

      const data = await response.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching available projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async (projectId, openingId) => {
    try {
      await onRequestJoin(projectId, openingId, message);
      // Update the local state to reflect the request
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project._id === projectId
            ? {
                ...project,
                openings: project.openings.map(opening =>
                  opening._id === openingId
                    ? { ...opening, hasRequested: true }
                    : opening
                )
              }
            : project
        )
      );
      setMessage('');
      setSelectedOpening(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Available Projects</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        ) : projects.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>No projects available at the moment.</Alert>
        ) : (
          <Box sx={{ mt: 2 }}>
            {projects.map((project) => (
              <Card key={project._id} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {project.description}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      <Code sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Technologies:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {project.technologies.map((tech, index) => (
                        <Chip key={index} label={tech} size="small" />
                      ))}
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" gutterBottom>
                    <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Available Positions:
                  </Typography>
                  {project.openings.map((opening) => (
                    <Box
                      key={opening._id}
                      sx={{
                        p: 1,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="subtitle2">{opening.role}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {opening.description}
                      </Typography>
                      {opening.skills && opening.skills.length > 0 && (
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Required Skills:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {opening.skills.map((skill, index) => (
                              <Chip key={index} label={skill} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {selectedOpening?._id === opening._id ? (
                        <Box sx={{ mt: 1 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            variant="outlined"
                            size="small"
                            placeholder="Add a message to your application (optional)"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            sx={{ mb: 1 }}
                          />
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              onClick={() => handleRequestJoin(project._id, opening._id)}
                            >
                              Submit Request
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                setSelectedOpening(null);
                                setMessage('');
                              }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => setSelectedOpening(opening)}
                          disabled={opening.hasRequested}
                          sx={{ mt: 1 }}
                        >
                          {opening.hasRequested ? 'Request Sent' : 'Request to Join'}
                        </Button>
                      )}
                    </Box>
                  ))}
                </CardContent>
                <CardActions>
                  {project.githubUrl && (
                    <Button
                      size="small"
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on GitHub
                    </Button>
                  )}
                  {project.liveUrl && (
                    <Button
                      size="small"
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Live Demo
                    </Button>
                  )}
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

export default JoinProjectsDialog; 