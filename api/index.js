require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const User = require('./models/User');
const UserData = require('./models/UserData');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files from the public directory (for local dev)
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  
  if (!process.env.MONGODB_URI) {
    console.warn('Warning: MONGODB_URI is not defined.');
    throw new Error('MONGODB_URI is not defined. Please check your .env file.');
  }
  
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = db.connections[0].readyState;
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    throw new Error(`DB Connect Failed: ${err.message}`);
  }
};

// Global Middleware to ensure DB connection
app.use(async (req, res, next) => {
  if (req.path === '/api') return next(); // Skip for health check
  try {
    await connectDB();
    next();
  } catch (e) {
    console.error('Middleware Connection Error:', e);
    // Return explicit JSON error
    res.status(500).json({ 
      error: 'Database connection failed',
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

// Auth Middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  // Simple token implementation: "userId:username" (In production, use JWT!)
  const [userId, username] = token.split(':');
  if (!userId || !username) return res.status(401).json({ error: 'Invalid Token' });
  
  req.user = { id: userId, username };
  next();
};

// Define Router to handle API routes
const router = express.Router();

// Health Check
router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username taken' });
    
    const user = new User({ username, password });
    await user.save();
    
    // Create empty data entry
    await new UserData({ userId: user._id, data: {} }).save();
    
    res.json({ success: true, userId: user._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = `${user._id}:${user.username}`;
    res.json({ success: true, token, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Sync Data (Pull)
router.get('/data', authenticate, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.user.id });
    res.json({ success: true, data: userData ? userData.data : {} });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Sync Data (Push)
router.post('/data', authenticate, async (req, res) => {
  try {
    const { data } = req.body;
    
    let userData = await UserData.findOne({ userId: req.user.id });
    if (!userData) {
      userData = new UserData({ userId: req.user.id, data: {} });
    }
    
    // Update keys
    if (data) {
        for (const [key, value] of Object.entries(data)) {
          userData.data.set(key, value);
        }
    }
    
    userData.updatedAt = Date.now();
    await userData.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Mount router at /api AND / (to handle Vercel rewrites robustly)
app.use('/api', router);
app.use('/', router);

// Catch-all 404 for API requests to ensure JSON response
app.use((req, res) => {
  res.status(404).json({ 
    error: `API Endpoint not found: ${req.method} ${req.url}`,
    path: req.path
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
