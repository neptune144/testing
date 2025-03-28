import React, { useState, useEffect } from 'react';
import { Box, Paper, Grid } from '@mui/material';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

const Chat = () => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      
      // Log the received chats for debugging
      console.log('Received chats:', data.map(chat => ({
        id: chat._id,
        type: chat.type,
        projectId: chat.project?._id,
        projectName: chat.project?.name
      })));

      setChats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const handleChatSelect = (chat) => {
    // Log the selected chat for debugging
    console.log('Selected chat:', {
      id: chat._id,
      type: chat.type,
      project: chat.project,
      projectId: chat.project?.id || chat.project?._id,
      projectName: chat.project?.name
    });

    // Ensure project data is properly structured for project chats
    if (chat.type === 'project' && chat.project) {
      // If project is a string (ID), convert it to an object
      if (typeof chat.project === 'string') {
        chat = {
          ...chat,
          project: {
            _id: chat.project,
            name: 'Loading...' // This will be updated when ChatWindow fetches project details
          }
        };
      }
      
      // Validate project object structure - check for either id or _id
      const projectId = chat.project.id || chat.project._id;
      if (!projectId) {
        console.error('Invalid project structure:', chat.project);
        setError('Invalid project configuration');
        return;
      }

      // Normalize the project structure to use _id
      chat = {
        ...chat,
        project: {
          ...chat.project,
          _id: projectId
        }
      };
    }

    setSelectedChat(chat);
  };

  const handleMessageSent = (message) => {
    // Update the chat list with the new message
    setChats(prevChats => {
      return prevChats.map(chat => {
        if (chat._id === selectedChat._id) {
          return {
            ...chat,
            lastMessage: {
              content: message.content,
              sender: message.sender,
              createdAt: message.createdAt
            }
          };
        }
        return chat;
      });
    });
  };

  return (
    <Box sx={{ 
      flexGrow: 1, 
      height: '100vh', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default'
    }}>
      <Grid container sx={{ 
        height: '100%',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* Chat List Column */}
        <Grid item xs={12} md={4} lg={3} sx={{ 
          height: '100%',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: { xs: selectedChat ? 'none' : 'flex', md: 'flex' },
          flexDirection: 'column'
        }}>
          <Box sx={{ 
            height: '100%', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <ChatList
              chats={chats}
              selectedChat={selectedChat}
              onChatSelect={handleChatSelect}
              loading={loading}
              error={error}
            />
          </Box>
        </Grid>

        {/* Chat Window Column */}
        <Grid item xs={12} md={8} lg={9} sx={{ 
          height: '100%',
          display: { xs: selectedChat ? 'flex' : 'none', md: 'flex' },
          flexDirection: 'column'
        }}>
          <Box sx={{ 
            height: '100%', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper'
          }}>
            {selectedChat ? (
              <ChatWindow
                key={selectedChat._id}
                chat={selectedChat}
                onMessageSent={handleMessageSent}
                onError={(error) => setError(error)}
              />
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.secondary'
                }}
              >
                Select a chat to start messaging
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Chat; 