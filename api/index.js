require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const User = require('./models/User');
const UserData = require('./models/UserData');
const Message = require('./models/Message');
const Manual = require('./models/Manual');
const Notice = require('./models/Notice');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files from the public directory
// Important: This must be unconditional so Vercel's build system (NFT) includes the public folder
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html', 'htm'] }));

// Connect to MongoDB
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  
  if (!process.env.MONGODB_URI) {
    console.warn('Warning: MONGODB_URI is not defined.');
    throw new Error('MONGODB_URI is not defined. Please check your .env file.');
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
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
  const parts = token.split(':');
  if (parts.length < 2) return res.status(401).json({ error: 'Invalid Token' });
  
  const userId = parts[0];
  // Handle potential encoded usernames
  const username = decodeURIComponent(parts.slice(1).join(':'));
  
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

// Auth Status Check
router.get('/auth/status', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;
    
    // Fetch latest user data to get lastNoticeSeenAt
    const user = await User.findById(req.user.id);
    const lastNoticeSeenAt = user ? user.lastNoticeSeenAt : null;
    
    res.json({ success: true, username: currentUsername, isAdmin, lastNoticeSeenAt });
  } catch (e) {
    console.error('Auth Status Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Register
router.post('/register', async (req, res) => {
  // Check if Admin restriction is enabled
  const adminUser = process.env.ADMIN_USERNAME;
  
  if (adminUser) {
    // If Admin restriction is on, we need to verify the requester is the admin
    // We manually invoke the authenticate middleware logic here to keep the route definition simple
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: '仅管理员可创建新账号' });
    
    const parts = token.split(':');
    if (parts.length < 2) return res.status(401).json({ error: 'Invalid Token' });
    
    const requestUsername = decodeURIComponent(parts.slice(1).join(':'));
    
    if (requestUsername !== adminUser) {
      return res.status(403).json({ error: '您没有权限执行此操作' });
    }
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '请填写所有必填项' });
    
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: '用户名已存在' });
    
    const user = new User({ username, password });
    await user.save();
    
    // Create empty data entry
    await new UserData({ userId: user._id, data: {} }).save();
    
    res.json({ success: true, userId: user._id });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    console.error(e);
    res.status(500).json({ error: '注册失败: ' + e.message });
  }
});

// Change Password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: '请提供新密码' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    user.password = newPassword;
    await user.save();

    console.log(`Password changed for user: ${user.username}`);
    res.json({ success: true, message: '密码已修改' });
  } catch (e) {
    console.error('Change Password Error:', e);
    res.status(500).json({ error: '修改密码失败: ' + e.message });
  }
});

// Get Users (Admin Only)
router.get('/users', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足' });
    }

    const users = await User.find({}, 'username').sort({ username: 1 });
    const usernames = users.map(u => u.username);
    
    res.json({ success: true, users: usernames });
  } catch (e) {
    console.error('Get Users Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = `${user._id}:${encodeURIComponent(user.username)}`;
    const isAdmin = process.env.ADMIN_USERNAME === user.username;
    
    res.json({ success: true, token, username: user.username, isAdmin });
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

// --- Message Routes ---

// Get Messages
router.get('/messages', authenticate, async (req, res) => {
  // Prevent caching strictly
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const currentUsername = req.user.username;
    // Check if current user is admin based on ENV variable
    // Note: In a real app, this should be in the User database model
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'inbox'; // 'inbox' or 'sent'

    let query = {};
    
    if (isAdmin) {
      if (type === 'sent') {
        // Admin sent: messages sent by 'admin'
        query = { sender: currentUsername };
      } else {
        // Admin inbox: messages sent TO 'admin'
        query = { receiver: 'admin' };
      }
    } else {
      if (type === 'sent') {
        // User sent: messages sent BY user
        query = { sender: currentUsername };
      } else {
        // User inbox: messages sent TO 'all_users' (Announcements) or TO this user (if any)
        query = {
          $or: [
            { receiver: 'all_users' },
            { receiver: currentUsername }
          ]
        };
      }
    }

    // Performance Optimization: Limit to recent messages by default
    const totalCount = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .sort({ timestamp: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();
    
    console.log(`[GET Messages] User: ${currentUsername}, IsAdmin: ${isAdmin}, Count: ${messages.length}, Total: ${totalCount}`);

    const result = messages.map(msg => {
      const isSenderAdmin = adminUsername && msg.sender === adminUsername;
      
      return {
        _id: msg._id.toString(),
        content: msg.content,
        timestamp: msg.timestamp,
        sender: msg.sender,
        receiver: msg.receiver,
        // Derived fields for frontend convenience
        isMe: msg.sender === currentUsername,
        isAnnouncement: msg.receiver === 'all_users',
        senderDisplay: isSenderAdmin ? '管理员 (公告)' : msg.sender,
        isRead: msg.readBy ? msg.readBy.includes(currentUsername) : false
      };
    });

    res.json({ 
      success: true, 
      messages: result,
      total: totalCount,
      page,
      limit,
      currentUser: currentUsername,
      isAdmin: isAdmin,
      debug_info: {
        adminUsernameEnv: adminUsername,
        query: query
      }
    });
  } catch (e) {
    console.error('Get Messages Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Send Message
router.post('/messages', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: '内容不能为空' });

    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    let receiver;
    
    if (isAdmin) {
      // Admin always broadcasts to all
      receiver = 'all_users';
    } else {
      // Regular users always send to admin
      receiver = 'admin';
    }

    console.log(`[Message] From: ${currentUsername}, To: ${receiver}, IsAdmin: ${isAdmin}`);

    const message = new Message({
      sender: currentUsername,
      receiver: receiver,
      content,
      readBy: [currentUsername]
    });

    await message.save();
    res.json({ success: true, message, debug_receiver: receiver });
  } catch (e) {
    console.error('Send Message Error:', e);
    res.status(500).json({ error: e.message, stack: process.env.NODE_ENV === 'development' ? e.stack : undefined });
  }
});

// Mark Message as Read
router.put('/messages/:id/read', authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (!message.readBy.includes(req.user.username)) {
      message.readBy.push(req.user.username);
      await message.save();
    }
    
    res.json({ success: true });
  } catch (e) {
    console.error('Mark Read Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Manual Content (Public or Authenticated)
// Assuming we want public access so users can read it easily
router.get('/manual', async (req, res) => {
  try {
    const manual = await Manual.findOne();
    res.json({ success: true, content: manual ? manual.content : '' });
  } catch (e) {
    console.error('Get Manual Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update Manual Content (Admin Only)
router.put('/manual', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足：只有管理员可以编辑使用说明' });
    }

    let manual = await Manual.findOne();
    if (manual) {
      manual.content = content;
      manual.lastUpdated = Date.now();
      manual.updatedBy = currentUsername;
    } else {
      manual = new Manual({
        content,
        updatedBy: currentUsername
      });
    }

    await manual.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Update Manual Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Notice Routes ---

// Get All Notices (Admin Only) - For management
router.get('/admin/notices', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足' });
    }

    const notices = await Notice.find().sort({ lastUpdated: -1 });
    res.json({ success: true, notices });
  } catch (e) {
    console.error('Get All Notices Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete Notice (Admin Only)
router.delete('/admin/notices/:id', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足' });
    }

    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete Notice Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Notice (Public/User View)
router.get('/notice', async (req, res) => {
  try {
    // Check for Admin Inspection Query
    const requestedTarget = req.query.targetUser;
    const token = req.headers.authorization;
    let currentUser = null;
    let isAdmin = false;

    if (token) {
      const parts = token.split(':');
      if (parts.length >= 2) {
        currentUser = decodeURIComponent(parts.slice(1).join(':'));
        const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
        isAdmin = adminUsername && currentUser === adminUsername;
      }
    }

    // Admin requesting specific target's notice
    if (requestedTarget && isAdmin) {
       let query = { targetUser: requestedTarget };
       if (requestedTarget === 'all') {
         query = { $or: [{ targetUser: 'all' }, { targetUser: { $exists: false } }] };
       }
       const notice = await Notice.findOne(query);
       return res.json({
         success: true,
         content: notice ? notice.content : '',
         lastUpdated: notice ? notice.lastUpdated : null,
         targetUser: requestedTarget
       });
    }

    // Normal User Logic (View Mode)
    // Find Global Notice
    const globalNotice = await Notice.findOne({ 
      $or: [{ targetUser: 'all' }, { targetUser: { $exists: false } }] 
    });

    // Find Private Notice if user is known
    let privateNotice = null;
    if (currentUser) {
      privateNotice = await Notice.findOne({ targetUser: currentUser });
    }

    // Determine which to show (Latest one)
    let noticeToShow = globalNotice;
    if (privateNotice) {
      if (!globalNotice || new Date(privateNotice.lastUpdated) > new Date(globalNotice.lastUpdated)) {
        noticeToShow = privateNotice;
      }
    }

    res.json({ 
      success: true, 
      content: noticeToShow ? noticeToShow.content : '',
      lastUpdated: noticeToShow ? noticeToShow.lastUpdated : null,
      targetUser: noticeToShow ? (noticeToShow.targetUser || 'all') : 'all'
    });
  } catch (e) {
    console.error('Get Notice Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update Notice (Admin Only)
router.put('/notice', authenticate, async (req, res) => {
  try {
    const { content, targetUser = 'all' } = req.body;
    
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足：只有管理员可以编辑告示' });
    }

    // Update or Create Notice for the specific target
    let query = { targetUser };
    if (targetUser === 'all') {
      query = { $or: [{ targetUser: 'all' }, { targetUser: { $exists: false } }] };
    }

    let notice = await Notice.findOne(query);
    if (notice) {
      notice.content = content;
      notice.lastUpdated = Date.now();
      notice.updatedBy = currentUsername;
      // Ensure targetUser is set correctly if it was missing (legacy docs)
      if (!notice.targetUser) notice.targetUser = 'all';
    } else {
      notice = new Notice({
        content,
        updatedBy: currentUsername,
        targetUser
      });
    }

    await notice.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Update Notice Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Acknowledge Notice (User has seen it)
router.post('/notice/ack', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.lastNoticeSeenAt = Date.now();
    await user.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error('Ack Notice Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete Message (Admin Only)
router.delete('/messages/:id', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '只有管理员可以撤回消息' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: '消息不存在' });

    // Ensure admin can only delete their own messages (optional, but requested "retract own messages")
    // If the requirement is "admin can delete ANY message", we remove this check.
    // The prompt says "admin can retract THEIR OWN messages".
    if (message.sender !== currentUsername) {
      return res.status(403).json({ error: '只能撤回自己发送的消息' });
    }

    await Message.findByIdAndDelete(req.params.id);
    console.log(`[Delete Message] Admin ${currentUsername} deleted message ${req.params.id}`);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Delete Message Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Mount router at /api AND / (to handle Vercel rewrites robustly)
app.use('/api', router);
app.use('/', router);

// Catch-all 404 for API requests to ensure JSON response
app.use((req, res) => {
  console.log(`404 Hit: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: `API Endpoint not found: ${req.method} ${req.url}`,
    path: req.path,
    debug_info: {
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      headers: req.headers
    }
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
