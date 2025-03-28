// Safe storage operations with error handling
const storage = {
  // Set data in localStorage with proper error handling
  set: (key, value) => {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error(`Error storing data for key "${key}":`, error);
      return false;
    }
  },

  // Get data from localStorage with proper error handling
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      
      return JSON.parse(item);
    } catch (error) {
      console.error(`Error retrieving data for key "${key}":`, error);
      return defaultValue;
    }
  },

  // Remove specific item from localStorage
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing data for key "${key}":`, error);
      return false;
    }
  },

  // Clear all data from localStorage
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  },

  // Store user data safely
  setUser: (userData) => {
    if (!userData || typeof userData !== 'object') {
      console.error('Invalid user data provided');
      return false;
    }

    // Ensure minimum required user data
    if (!userData.username || !userData.name) {
      console.error('Missing required user data fields');
      return false;
    }

    return storage.set('user', userData);
  },

  // Get user data safely
  getUser: () => {
    return storage.get('user', null);
  },

  // Store authentication token with enhanced validation
  setToken: (token) => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      console.error('Invalid or empty token provided');
      return false;
    }
    try {
      localStorage.setItem('token', token);
      return true;
    } catch (error) {
      console.error('Error storing token:', error);
      return false;
    }
  },

  // Get authentication token with enhanced validation and fallback
  getToken: () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || token.trim() === '') {
        return null;
      }
      return token;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    try {
      const token = storage.getToken();
      const user = storage.getUser();
      return !!(token && user);
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  },

  // Clear all auth-related data with enhanced error handling
  clearAuth: () => {
    try {
      storage.remove('user');
      storage.remove('token');
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      // Attempt forceful clear as fallback
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } catch (e) {
        console.error('Forceful clear also failed:', e);
      }
      return false;
    }
  }
};

export default storage; 