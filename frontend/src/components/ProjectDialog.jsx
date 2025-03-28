import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Autocomplete,
  Chip,
  IconButton,
  Typography,
  Grid,
  Divider,
} from '@mui/material';
import { Close, Add } from '@mui/icons-material';

const ProjectDialog = ({ open, onClose, project, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    technologies: [],
    githubUrl: '',
    liveUrl: '',
    openings: [],
    deadline: ''
  });
  const [techInput, setTechInput] = useState('');
  const [openingInput, setOpeningInput] = useState({
    role: '',
    description: '',
    skills: [],
  });
  const [openingSkillInput, setOpeningSkillInput] = useState('');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        technologies: project.technologies || [],
        githubUrl: project.githubUrl || '',
        liveUrl: project.liveUrl || '',
        openings: project.openings || [],
        deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        technologies: [],
        githubUrl: '',
        liveUrl: '',
        openings: [],
        deadline: ''
      });
    }
  }, [project]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleTechnologiesChange = (event, newValue) => {
    setFormData(prev => ({
      ...prev,
      technologies: newValue
    }));
  };

  const handleAddTechnology = () => {
    if (techInput.trim()) {
      setFormData(prev => ({
        ...prev,
        technologies: [...prev.technologies, techInput.trim()]
      }));
      setTechInput('');
    }
  };

  const handleRemoveTechnology = (index) => {
    setFormData(prev => ({
      ...prev,
      technologies: prev.technologies.filter((_, i) => i !== index)
    }));
  };

  const handleOpeningInputChange = (e) => {
    const { name, value } = e.target;
    setOpeningInput(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddOpeningSkill = () => {
    if (openingSkillInput.trim()) {
      setOpeningInput(prev => ({
        ...prev,
        skills: [...prev.skills, openingSkillInput.trim()]
      }));
      setOpeningSkillInput('');
    }
  };

  const handleRemoveOpeningSkill = (index) => {
    setOpeningInput(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const handleAddOpening = () => {
    if (openingInput.role.trim() && openingInput.description.trim()) {
      setFormData(prev => ({
        ...prev,
        openings: [...prev.openings, { ...openingInput }]
      }));
      setOpeningInput({
        role: '',
        description: '',
        skills: [],
      });
    }
  };

  const handleRemoveOpening = (index) => {
    setFormData(prev => ({
      ...prev,
      openings: prev.openings.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Project description is required';
    }
    if (!formData.deadline) {
      newErrors.deadline = 'Project deadline is required';
    }
    if (formData.githubUrl && !isValidUrl(formData.githubUrl)) {
      newErrors.githubUrl = 'Please enter a valid GitHub URL';
    }
    if (formData.liveUrl && !isValidUrl(formData.liveUrl)) {
      newErrors.liveUrl = 'Please enter a valid URL';
    }
    return newErrors;
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleSubmit = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length === 0) {
      onSave(formData);
      onClose();
    } else {
      setErrors(newErrors);
    }
  };

  // Common technologies for autocomplete suggestions
  const commonTechnologies = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
    'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
    'HTML', 'CSS', 'SASS', 'TailwindCSS', 'Material-UI',
    'Express.js', 'Django', 'Flask', 'Spring Boot',
    'GraphQL', 'REST API', 'WebSocket'
  ];

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        {project ? 'Edit Project' : 'Add New Project'}
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            name="name"
            label="Project Name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            error={!!errors.name}
            helperText={errors.name}
            required
          />

          <TextField
            name="description"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            error={!!errors.description}
            helperText={errors.description}
            required
          />

          <TextField
            fullWidth
            label="Project Deadline"
            name="deadline"
            type="date"
            value={formData.deadline}
            onChange={handleInputChange}
            margin="normal"
            required
            error={!!errors.deadline}
            helperText={errors.deadline || 'Set a deadline for project completion'}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: new Date().toISOString().split('T')[0]
            }}
          />

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Technologies</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              label="Add Technology"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTechnology()}
            />
            <Button onClick={handleAddTechnology} startIcon={<Add />}>
              Add
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {formData.technologies.map((tech, index) => (
              <Chip
                key={index}
                label={tech}
                onDelete={() => handleRemoveTechnology(index)}
              />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Project Openings</Typography>
          <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Add New Opening</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Role"
                  name="role"
                  value={openingInput.role}
                  onChange={handleOpeningInputChange}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={openingInput.description}
                  onChange={handleOpeningInputChange}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    label="Add Required Skill"
                    value={openingSkillInput}
                    onChange={(e) => setOpeningSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddOpeningSkill()}
                    size="small"
                  />
                  <Button 
                    onClick={handleAddOpeningSkill}
                    startIcon={<Add />}
                    size="small"
                  >
                    Add Skill
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {openingInput.skills.map((skill, index) => (
                    <Chip
                      key={index}
                      label={skill}
                      size="small"
                      onDelete={() => handleRemoveOpeningSkill(index)}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleAddOpening}
                  startIcon={<Add />}
                  disabled={!openingInput.role.trim() || !openingInput.description.trim()}
                >
                  Add Opening
                </Button>
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ mb: 2 }}>
            {formData.openings.map((opening, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  mb: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  position: 'relative'
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => handleRemoveOpening(index)}
                  sx={{ position: 'absolute', right: 8, top: 8 }}
                >
                  <Close />
                </IconButton>
                <Typography variant="subtitle2">{opening.role}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {opening.description}
                </Typography>
                {opening.skills && opening.skills.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Required Skills:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {opening.skills.map((skill, skillIndex) => (
                        <Chip
                          key={skillIndex}
                          label={skill}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ))}
          </Box>

          <TextField
            name="githubUrl"
            label="GitHub Repository URL"
            fullWidth
            value={formData.githubUrl}
            onChange={handleInputChange}
            error={!!errors.githubUrl}
            helperText={errors.githubUrl}
          />

          <TextField
            name="liveUrl"
            label="Live Project URL"
            fullWidth
            value={formData.liveUrl}
            onChange={handleInputChange}
            error={!!errors.liveUrl}
            helperText={errors.liveUrl}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          color="primary"
        >
          {project ? 'Save Changes' : 'Add Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectDialog; 