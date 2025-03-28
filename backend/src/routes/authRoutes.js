import express from 'express';
import { register, login } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route example
router.get('/profile', protect, (req, res) => {
  res.json({ user: req.user });
});

export default router; 