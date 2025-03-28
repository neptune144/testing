import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
  Typography,
  Paper,
  Box,
  Badge,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Message, Person, AccessTime } from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import storage from '../utils/storage';







const ChatList = ({ onChatSelect, selectedChatId }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const getDeadlineColor = (deadline) => {
    if (!deadline) return 'default';
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysRemaining = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return 'error';
    if (daysRemaining <= 3) return 'warning';
    if (daysRemaining <= 7) return 'info';
    return 'default';
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const token = storage.getToken();
      console.log('Fetching chats with token:', token ? 'Token exists' : 'No token');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      console.log('Chats loaded:', data);
      setChats(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError(err.message || 'Failed to load chats');
      setLoading(false);
    }
  };

  const getChatTitle = (chat) => {
    if (chat.type === 'project') {
      return chat.project?.name || 'Project Chat';
    }
    const otherParticipant = chat.participants?.find(p => p._id !== storage.getUser()?._id);
    return otherParticipant?.username || 'Chat';
  };

  const getLastMessagePreview = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    return chat.lastMessage.content.length > 30 
      ? `${chat.lastMessage.content.substring(0, 30)}...` 
      : chat.lastMessage.content;
  };

  return (
    <Box 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper'
      }}
    >
      <List 
        sx={{ 
          width: '100%',
          height: '100%',
          p: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(0, 0, 0, 0.3)',
          }
        }}
      >
        {loading ? (
          <Box 
            display="flex" 
            justifyContent="center" 
            alignItems="center" 
            minHeight={isMobile ? "100px" : "200px"}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert 
            severity="error" 
            sx={{ 
              m: { xs: 1, sm: 2 },
              fontSize: { xs: '0.875rem', sm: '1rem' }
            }}
          >
            {error}
          </Alert>
        ) : chats.length === 0 ? (
          <Box 
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3
            }}
          >
            <Typography 
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              No chats yet
            </Typography>
          </Box>
        ) : (
          chats.map((chat) => {
            const isSelected = selectedChatId === chat._id;

            return (
              <ListItem
                key={chat._id}
                disablePadding
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <ListItemButton
                  onClick={() => onChatSelect(chat)}
                  selected={isSelected}
                  sx={{
                    py: { xs: 1.5, sm: 2 },
                    px: { xs: 2, sm: 3 },
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        width: { xs: 40, sm: 45 },
                        height: { xs: 40, sm: 45 },
                        bgcolor: isSelected ? 'primary.main' : 'grey.400'
                      }}
                    >
                      {chat.type === 'project' ? <Message /> : <Person />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          gap: 1,
                          mb: 0.5
                        }}
                      >
                        <Typography 
                          variant="subtitle1"
                          sx={{
                            fontSize: { xs: '0.9rem', sm: '1rem' },
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'primary.main' : 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: { xs: '150px', sm: '200px', md: '300px' }
                          }}
                        >
                          {chat.project?.name || chat.title || 'Untitled Chat'}
                        </Typography>
                        {chat.lastMessage?.createdAt && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{
                              fontSize: { xs: '0.7rem', sm: '0.75rem' },
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {formatDistanceToNow(new Date(chat.lastMessage.createdAt), { addSuffix: true })}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          flexWrap: 'nowrap'
                        }}
                      >
                        {chat.type === 'project' && (
                          <Chip
                            size="small"
                            label="Project"
                            color={isSelected ? 'primary' : 'default'}
                            variant={isSelected ? 'filled' : 'outlined'}
                            sx={{ 
                              height: { xs: 18, sm: 20 },
                              '& .MuiChip-label': {
                                px: 1,
                                fontSize: { xs: '0.65rem', sm: '0.75rem' }
                              }
                            }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: { xs: '180px', sm: '250px', md: '350px' }
                          }}
                        >
                          {chat.lastMessage?.content || 'No messages yet'}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      my: 0
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        )}
      </List>
    </Box>
  );
};

export default ChatList;