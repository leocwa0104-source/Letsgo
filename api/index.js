require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const User = require('./models/User');
const Plan = require('./models/Plan');
const UserData = require('./models/UserData');
const Message = require('./models/Message');
const Manual = require('./models/Manual');
const Notice = require('./models/Notice');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve static files from the public directory
// Important: This must be unconditional so Vercel's build system (NFT) includes the public folder
app.use(express.static(path.join(__dirname, '../'), { extensions: ['html', 'htm'] }));

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

  // Verify User Exists in DB
  try {
      const userExists = await User.findById(userId);
      if (!userExists) {
          return res.status(401).json({ error: 'User account no longer exists' });
      }
  } catch (e) {
      console.error("Auth Middleware DB Check Error:", e);
      return res.status(500).json({ error: 'Auth check failed' });
  }
  
  req.user = { id: userId, username };
  next();
};

// Helper: Generate 6-char random Friend ID
function generateFriendId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed similar looking chars (0, O, 1, I)
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Define Router to handle API routes
const router = express.Router();

// Check Auth Status (and get Friend ID & Profile)
router.get('/auth/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && user.username === adminUsername;
    
    // Lazy migration: Generate friendId if missing
    if (!user.friendId) {
      user.friendId = generateFriendId();
      await user.save();
    }

    res.json({ 
        success: true, 
        isAdmin, 
        friendId: user.friendId, 
        username: user.username,
        lastNoticeSeenAt: user.lastNoticeSeenAt,
        nickname: user.nickname,
        avatar: user.avatar,
        home: user.home
    });
  } catch (e) {
    console.error('Auth Status Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Search Friend by ID
router.get('/friends/search', authenticate, async (req, res) => {
  try {
    const { fid } = req.query;
    if (!fid) return res.status(400).json({ error: 'Friend ID required' });

    // Case insensitive search
    const user = await User.findOne({ 
      friendId: { $regex: new RegExp(`^${fid}$`, 'i') } 
    });

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        username: user.username,
        friendId: user.friendId,
        nickname: user.nickname,
        avatar: user.avatar
      }
    });
  } catch (e) {
    console.error('Search Friend Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Send Friend Request
router.post('/friends/request', authenticate, async (req, res) => {
  try {
    const { targetFriendId } = req.body;
    const currentUsername = req.user.username;
    
    if (!targetFriendId) return res.status(400).json({ error: 'Target ID required' });
    
    // 1. Find target user
    const targetUser = await User.findOne({ 
      friendId: { $regex: new RegExp(`^${targetFriendId}$`, 'i') } 
    });
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.username === currentUsername) return res.status(400).json({ error: 'Cannot add yourself' });
    
    // 2. Check if already friends
    if (targetUser.friends && targetUser.friends.includes(currentUsername)) {
      return res.status(400).json({ error: 'Already friends' });
    }
    
    // 3. Check if request already exists
    const existingReq = targetUser.friendRequests.find(r => r.from === currentUsername && r.status === 'pending');
    if (existingReq) {
      return res.status(400).json({ error: 'Request already sent' });
    }
    
    // 4. Add request
    targetUser.friendRequests.push({
      from: currentUsername,
      status: 'pending'
    });
    
    await targetUser.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error('Send Request Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Pending Friend Requests
router.get('/friends/requests', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Filter only pending requests
    // We also want to get the sender's Friend ID to display
    const pendingRequests = user.friendRequests.filter(r => r.status === 'pending');
    
    // Enrich with sender details (optional but good for UI)
    const enrichedRequests = [];
    for (const req of pendingRequests) {
      const sender = await User.findOne({ username: req.from });
      if (sender) {
        enrichedRequests.push({
          from: req.from,
          fromNickname: sender.nickname,
          fromFriendId: sender.friendId,
          fromAvatar: sender.avatar,
          timestamp: req.timestamp
        });
      }
    }
    
    res.json({ success: true, requests: enrichedRequests });
  } catch (e) {
    console.error('Get Requests Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Respond to Friend Request
router.post('/friends/respond', authenticate, async (req, res) => {
  try {
    const { requesterUsername, action } = req.body; // action: 'accept' | 'reject'
    const currentUsername = req.user.username;
    
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Find the request
    const request = user.friendRequests.find(r => r.from === requesterUsername && r.status === 'pending');
    if (!request) return res.status(404).json({ error: 'Request not found or already handled' });
    
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    
    if (action === 'accept') {
      // Add to my friends list
      if (!user.friends.includes(requesterUsername)) {
        user.friends.push(requesterUsername);
      }
      
      // Add me to requester's friends list
      const requester = await User.findOne({ username: requesterUsername });
      if (requester) {
        if (!requester.friends.includes(currentUsername)) {
          requester.friends.push(currentUsername);
          await requester.save();
        }
      }
    }
    
    await user.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Respond Request Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get My Friends List
router.get('/friends/list', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const friendsList = [];
    if (user.friends && user.friends.length > 0) {
      // Optimization: Do not fetch avatar (Base64) to reduce payload size significantly
      // Frontend currently uses first letter of username anyway
      // Update: Now fetching avatar as requested
      const friends = await User.find({ username: { $in: user.friends } }, 'username friendId nickname avatar');
      friendsList.push(...friends);
    }
    
    res.json({ success: true, friends: friendsList });
  } catch (e) {
    console.error('Get Friends List Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Health Check
router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
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

// Update Profile (Nickname, Avatar & Home)
router.post('/update-profile', authenticate, async (req, res) => {
  try {
    const { nickname, avatar, home } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    if (nickname !== undefined) user.nickname = nickname.trim().substring(0, 30); // Limit length
    if (avatar !== undefined) {
        // Limit length (allows ~2MB Base64 image). Do NOT truncate blindly, or image breaks.
        // Frontend compresses to ~50KB, so this is plenty.
        if (avatar.length > 2000000) {
            return res.status(400).json({ error: '图片过大，请上传更小的图片' });
        }
        user.avatar = avatar;
    }

    if (home !== undefined) {
        // Validate home structure roughly
        if (typeof home === 'object') {
            user.home = {
                name: home.name || '',
                address: home.address || '',
                location: {
                    lat: home.location?.lat || 0,
                    lng: home.location?.lng || 0
                }
            };
        }
    }
    
    await user.save();
    
    res.json({ 
        success: true, 
        message: '个人资料已更新', 
        nickname: user.nickname, 
        avatar: user.avatar,
        home: user.home
    });
  } catch (e) {
    console.error('Update Profile Error:', e);
    res.status(500).json({ error: '更新失败: ' + e.message });
  }
});

// Delete User (Admin Only)
router.delete('/admin/users/:id', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足' });
    }

    const userId = req.params.id;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const userToDelete = await User.findById(userId);
    if (!userToDelete) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting the admin account itself
    if (userToDelete.username === adminUsername) {
         return res.status(400).json({ error: '无法删除管理员账户' });
    }

    await User.findByIdAndDelete(userId);
    // Also delete associated data
    await UserData.deleteMany({ userId: userId });
    // And Plans? Maybe keep plans or delete them. For now, we leave plans as orphaned or handle elsewhere.
    // Ideally we should delete plans where owner is this user.
    await Plan.deleteMany({ owner: userId });

    res.json({ success: true, message: `用户 ${userToDelete.username} 已删除` });
  } catch (e) {
    console.error('Delete User Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get All Users (Admin Only)
router.get('/admin/users', authenticate, async (req, res) => {
  try {
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足' });
    }

    // Return full user details for admin
    let users = await User.find({}, 'username nickname friendId createdAt _id').sort({ createdAt: -1 });
    
    // Check and backfill missing friendIds
    let hasUpdates = false;
    for (const user of users) {
        if (!user.friendId) {
            user.friendId = generateFriendId();
            // We need to save this update to DB
            // Since we fetched a lean object or partial fields, we might need to update via Model
            await User.findByIdAndUpdate(user._id, { friendId: user.friendId });
            hasUpdates = true;
        }
    }

    // If we updated anything, strictly we might want to re-fetch or just return the modified list.
    // Since we modified the objects in the array in-place (if they are Mongoose docs), it's fine.
    // If they are POJOs (lean), we modified the object reference.
    // Let's ensure we are returning the updated values.
    
    res.json({ success: true, users });
  } catch (e) {
    console.error('Get All Users Error:', e);
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
    
    // Lazy migration: Generate friendId if missing (for login path)
    if (!user.friendId) {
      user.friendId = generateFriendId();
      await user.save();
    }

    res.json({ 
      success: true, 
      token, 
      username: user.username, 
      isAdmin, 
      friendId: user.friendId,
      nickname: user.nickname,
      avatar: user.avatar 
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Sync Data (Pull)
router.get('/data', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
    
    // Update keys - Full Replace for consistency
    if (data) {
        // Clear existing data to ensure deleted keys are removed
        userData.data.clear();
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
    const { friend } = req.query; // If friend param exists, we are fetching chat history

    if (friend) {
      // Fetch private chat history
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const query = {
        $or: [
          { sender: currentUsername, receiver: friend },
          { sender: friend, receiver: currentUsername }
        ]
      };

      const totalCount = await Message.countDocuments(query);
      const messages = await Message.find(query)
        .sort({ timestamp: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .lean();

      // Mark messages from friend as read (lazy update)
      // Note: In a real app, this should be a separate API call or more robust
      // For now, we assume if you fetch the history, you read the messages.
      const unreadIds = messages
        .filter(m => m.sender === friend && (!m.readBy || !m.readBy.includes(currentUsername)))
        .map(m => m._id);

      if (unreadIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadIds } },
          { $addToSet: { readBy: currentUsername } }
        );
      }

      const result = messages.map(msg => ({
        _id: msg._id.toString(),
        content: msg.content,
        timestamp: msg.timestamp,
        sender: msg.sender,
        receiver: msg.receiver,
        isRecalled: msg.isRecalled,
        isMe: msg.sender === currentUsername,
        isRead: msg.readBy ? msg.readBy.includes(msg.sender === currentUsername ? friend : currentUsername) : false
      })).reverse(); // Return oldest first for chat UI

      return res.json({
        success: true,
        messages: result,
        total: totalCount,
        page,
        limit
      });
    }

    // --- Original Logic for System/Admin Messages ---
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
        query = { sender: currentUsername, receiver: 'admin' };
      } else {
        // User inbox: messages sent TO 'all_users' (Announcements) or TO this user (if any)
        query = {
          $or: [
            { receiver: 'all_users' },
            { receiver: currentUsername } // Direct system messages
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

    // Fetch nicknames for all senders
    const senderUsernames = [...new Set(messages.map(m => m.sender))];
    const senders = await User.find({ username: { $in: senderUsernames } }, 'username nickname');
    const nicknameMap = senders.reduce((acc, user) => {
      acc[user.username] = user.nickname || user.username;
      return acc;
    }, {});

    const result = messages.map(msg => {
      const isSenderAdmin = adminUsername && msg.sender === adminUsername;
      const nickname = nicknameMap[msg.sender] || msg.sender;
      
      return {
        _id: msg._id.toString(),
        content: msg.content,
        timestamp: msg.timestamp,
        sender: msg.sender,
        receiver: msg.receiver,
        isRecalled: msg.isRecalled,
        // Derived fields for frontend convenience
        isMe: msg.sender === currentUsername,
        isAnnouncement: msg.receiver === 'all_users',
        senderDisplay: isSenderAdmin ? '管理员 (公告)' : nickname,
        isRead: msg.readBy ? msg.readBy.includes(currentUsername) : false,
        type: msg.type,
        metadata: msg.metadata
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
    const { content, receiver: targetReceiver } = req.body;
    if (!content) return res.status(400).json({ error: '内容不能为空' });

    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    let receiver = targetReceiver;
    
    // Legacy logic compatibility: If no receiver specified
    if (!receiver) {
        if (isAdmin) {
          // Admin always broadcasts to all
          receiver = 'all_users';
        } else {
          // Regular users always send to admin
          receiver = 'admin';
        }
    } else {
        // Validation for specific receiver
        if (receiver !== 'admin' && receiver !== 'all_users') {
             // Check if receiver is a valid user and is a friend
             const targetUser = await User.findOne({ username: receiver });
             if (!targetUser) return res.status(404).json({ error: '用户不存在' });

             const currentUser = await User.findById(req.user.id);
             // Allow if it is a friend OR if sending to self (notes)
             if (!currentUser.friends.includes(receiver) && receiver !== currentUsername) {
                 // Also allow if we are replying to a message (this check is complex, skipping for now)
                 // For now, strict friend check
                 return res.status(403).json({ error: '只能给好友发送私信' });
             }
        }
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
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
       // Get the LATEST notice for this target
       const notice = await Notice.findOne(query).sort({ lastUpdated: -1 });
       return res.json({
         success: true,
         content: notice ? notice.content : '',
         lastUpdated: notice ? notice.lastUpdated : null,
         targetUser: requestedTarget
       });
    }

    // Normal User Logic (View Mode)
    // Find All Relevant Notices (Global + Private)
    const query = {
      $or: [
        { targetUser: 'all' },
        { targetUser: { $exists: false } },
        { targetUser: currentUser },
        { targetUser: { $in: [currentUser] } } // Handle array inclusion
      ]
    };

    const notices = await Notice.find(query).sort({ lastUpdated: -1 });

    res.json({ 
      success: true, 
      notices: notices.map(n => ({
        content: n.content,
        lastUpdated: n.lastUpdated,
        targetUser: n.targetUser || 'all',
        _id: n._id
      }))
    });
  } catch (e) {
    console.error('Get Notice Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Create Notice (Admin Only) - Always creates a new record (History)
router.post('/notice', authenticate, async (req, res) => {
  try {
    const { content, targetUser = 'all' } = req.body;
    
    const currentUsername = req.user.username;
    const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
    const isAdmin = adminUsername && currentUsername === adminUsername;

    if (!isAdmin) {
      return res.status(403).json({ error: '权限不足：只有管理员可以编辑告示' });
    }

    // Always create a NEW notice
    const notice = new Notice({
      content,
      updatedBy: currentUsername,
      targetUser
    });

    await notice.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Create Notice Error:', e);
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

// Recall Message (User, within 2 mins)
router.post('/messages/:id/recall', authenticate, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: '消息不存在' });

    if (message.sender !== req.user.username) {
      return res.status(403).json({ error: '只能撤回自己发送的消息' });
    }

    const now = new Date();
    const msgTime = new Date(message.timestamp);
    const diffSeconds = (now - msgTime) / 1000;

    if (diffSeconds > 120) {
      return res.status(400).json({ error: '超过2分钟无法撤回' });
    }

    message.isRecalled = true;
    await message.save();

    res.json({ success: true });
  } catch (e) {
    console.error('Recall Message Error:', e);
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

// --- Plan Routes (Collaboration) ---

// Get All Plans (Owned + Shared)
router.get('/plans', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const userId = req.user.id;
    // Find plans where I am owner OR I am in collaborators
    const plans = await Plan.find({
      $or: [
        { owner: userId },
        { collaborators: userId }
      ]
    })
    .populate('owner', 'username friendId avatar nickname')
    .populate('collaborators', 'username friendId avatar nickname')
    .sort({ updatedAt: -1 });
    
    res.json({ success: true, plans });
  } catch (e) {
    console.error('Get Plans Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Create Plan
router.post('/plans', authenticate, async (req, res) => {
  try {
    const { title, content, status } = req.body;
    const newPlan = new Plan({
      title: title || '未命名计划',
      owner: req.user.id,
      content: content || {},
      status: status || 'planning'
    });
    
    await newPlan.save();
    res.json({ success: true, plan: newPlan });
  } catch (e) {
    console.error('Create Plan Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get Single Plan
router.get('/plans/:id', authenticate, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const plan = await Plan.findById(req.params.id)
      .populate('owner', 'username friendId avatar nickname')
      .populate('collaborators', 'username friendId avatar nickname')
      .populate('pendingInvitations.invitee', 'username friendId avatar nickname')
      .populate('pendingInvitations.requester', 'username friendId avatar nickname');
      
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    
    // Check permission
    const userId = req.user.id;
    const isOwner = plan.owner._id.toString() === userId;
    const isCollaborator = plan.collaborators.some(c => c._id.toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    const planObj = plan.toObject();
    if (!isOwner) {
        delete planObj.pendingInvitations;
    }
    
    res.json({ success: true, plan: planObj });
  } catch (e) {
    console.error('Get Single Plan Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Update Plan
router.put('/plans/:id', authenticate, async (req, res) => {
  try {
    const { title, content, status } = req.body;
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    
    const userId = req.user.id;
    const isOwner = plan.owner.toString() === userId;
    const isCollaborator = plan.collaborators.some(c => c.toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Restrict renaming to owner only
    if (title && !isOwner) {
        return res.status(403).json({ error: 'Only owner can rename plan' });
    }

    if (title) plan.title = title;
    if (content) plan.content = content;
    if (status) plan.status = status;
    plan.updatedAt = Date.now();
    
    await plan.save();
    res.json({ success: true, plan });
  } catch (e) {
    console.error('Update Plan Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Invite Friend to Plan
router.post('/plans/:id/invite', authenticate, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'Friend ID required' });
    
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    
    // Only owner can invite? Or collaborators too? Let's say only owner for now.
    // Or anyone with edit access. Let's allow collaborators to invite too for maximum social.
    const userId = req.user.id;
    const isOwner = plan.owner.toString() === userId;
    const isCollaborator = plan.collaborators.some(c => c.toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Find user by friendId
    const friend = await User.findOne({ friendId: friendId });
    if (!friend) return res.status(404).json({ error: 'Friend not found' });
    
    if (friend._id.toString() === plan.owner.toString()) {
       return res.status(400).json({ error: 'Cannot invite owner' });
    }
    
    // Check if already in collaborators
    const alreadyIn = plan.collaborators.some(c => c.toString() === friend._id.toString());
    if (alreadyIn) {
      return res.json({ success: true, message: 'Already a collaborator' });
    }

    if (isOwner) {
      // Owner can invite directly
      plan.collaborators.push(friend._id);
      await plan.save();

      // Send Notification Message
      try {
        const joinMsg = new Message({
            sender: req.user.username,
            receiver: friend.username,
            content: `你已被加入计划 "${plan.title}"`,
            type: 'notification',
            metadata: {
                planId: plan._id,
                planTitle: plan.title
            },
            readBy: []
        });
        await joinMsg.save();
      } catch(e) { console.error("Failed to send join message", e); }

      return res.json({ success: true, message: 'Invited successfully', status: 'added' });
    } else {
      // Collaborator needs approval
      // Check if already pending
      const alreadyPending = plan.pendingInvitations && plan.pendingInvitations.some(p => p.invitee.toString() === friend._id.toString());
      if (alreadyPending) {
        return res.json({ success: true, message: 'Invitation pending approval', status: 'pending' });
      }

      plan.pendingInvitations.push({
        requester: userId,
        invitee: friend._id
      });
      await plan.save();

      // Send Invitation Message
      try {
        const inviteMsg = new Message({
            sender: req.user.username,
            receiver: friend.username,
            content: `邀请你加入计划 "${plan.title}"`,
            type: 'invitation',
            metadata: {
                planId: plan._id,
                planTitle: plan.title
            },
            readBy: []
        });
        await inviteMsg.save();
      } catch(e) { console.error("Failed to send invite message", e); }

      return res.json({ success: true, message: 'Invitation sent for approval', status: 'pending' });
    }
  } catch (e) {
    console.error('Invite Friend Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Approve Invitation
router.post('/plans/:id/invitations/approve', authenticate, async (req, res) => {
  try {
    const { inviteeId } = req.body;
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    if (plan.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can approve invitations' });
    }

    // Find in pending
    const inviteIndex = plan.pendingInvitations.findIndex(p => p.invitee.toString() === inviteeId);
    if (inviteIndex === -1) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Move to collaborators
    const invitee = plan.pendingInvitations[inviteIndex].invitee;
    if (!plan.collaborators.includes(invitee)) {
      plan.collaborators.push(invitee);
    }

    // Remove from pending
    plan.pendingInvitations.splice(inviteIndex, 1);
    await plan.save();

    res.json({ success: true });
  } catch (e) {
    console.error('Approve Invitation Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Reject Invitation
router.post('/plans/:id/invitations/reject', authenticate, async (req, res) => {
  try {
    const { inviteeId } = req.body;
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    if (plan.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can reject invitations' });
    }

    // Remove from pending
    plan.pendingInvitations = plan.pendingInvitations.filter(p => p.invitee.toString() !== inviteeId);
    await plan.save();

    res.json({ success: true });
  } catch (e) {
    console.error('Reject Invitation Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Leave Plan (Self-remove)
router.post('/plans/:id/leave', authenticate, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const userId = req.user.id.toString(); // Ensure string
    
    // Check if owner
    if (plan.owner && plan.owner.toString() === userId) {
        return res.status(400).json({ error: 'Owner cannot leave plan. Delete it instead.' });
    }

    // Remove req.user.id from collaborators
    // Use filter to create a new array excluding the current user
    const originalLength = plan.collaborators.length;
    plan.collaborators = plan.collaborators.filter(c => c && c.toString() !== userId);
    
    // Force mark modified if needed (though reassignment handles it)
    plan.markModified('collaborators');
    
    await plan.save();
    
    console.log(`[Leave Plan] User ${req.user.username} (${userId}) left plan ${plan._id}. Collaborators: ${originalLength} -> ${plan.collaborators.length}`);
    
    res.json({ success: true });
  } catch (e) {
    console.error('Leave Plan Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Remove Collaborator
router.post('/plans/:id/collaborators/remove', authenticate, async (req, res) => {
  try {
    const { collaboratorId } = req.body;
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    let targetUserId = collaboratorId;

    // Support friendId (short code) by resolving it to ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(collaboratorId)) {
        const user = await User.findOne({ friendId: collaboratorId });
        if (user) {
            targetUserId = user._id.toString();
        }
    }

    const isOwner = plan.owner.toString() === req.user.id;
    const isSelf = targetUserId === req.user.id;

    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Only owner can remove collaborators' });
    }

    plan.collaborators = plan.collaborators.filter(c => c.toString() !== targetUserId);
    await plan.save();

    res.json({ success: true });
  } catch (e) {
    console.error('Remove Collaborator Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete Plan (Owner only)
router.delete('/plans/:id', authenticate, async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    
    if (plan.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can delete plan' });
    }
    
    await Plan.findByIdAndDelete(req.params.id); 
    res.json({ success: true });
  } catch (e) {
    console.error('Delete Plan Error:', e);      
    res.status(500).json({ error: e.message });  
  }
});

// --- Content Library Routes (CMS) ---

const Content = require('./models/Content');

// Public: Get Random Content for a Module
router.get('/content/random', async (req, res) => {
    try {
        const { module } = req.query;
        if (!module) return res.status(400).json({ error: 'Module parameter required' });

        // Use MongoDB $sample for random selection
        const randomContent = await Content.aggregate([
            { $match: { module: module, isActive: true } },
            { $sample: { size: 1 } }
        ]);

        if (randomContent.length > 0) {
            res.json({ success: true, content: randomContent[0] });
        } else {
            res.json({ success: false, message: 'No content found' });
        }
    } catch (e) {
        console.error('Get Random Content Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: Add Content
router.post('/admin/content', authenticate, async (req, res) => {
    try {
        const currentUsername = req.user.username;
        const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
        const isAdmin = adminUsername && currentUsername === adminUsername;

        if (!isAdmin) {
            return res.status(403).json({ error: '权限不足：只有管理员可以发布内容' });
        }

        const { module, title, content, image, isActive } = req.body;
        
        if (!module) return res.status(400).json({ error: 'Module required' });
        if (!content && !image && !title) return res.status(400).json({ error: 'Content (text, image, or title) required' });

        const newContent = new Content({
            module,
            title: title || '',
            content: content || '',
            image: image || '',
            contentType: 'mixed',
            isActive: isActive !== undefined ? isActive : true,
            author: currentUsername
        });

        await newContent.save();
        res.json({ success: true, content: newContent });
    } catch (e) {
        console.error('Add Content Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: Get All Content (with filtering)
router.get('/admin/content', authenticate, async (req, res) => {
    try {
        const currentUsername = req.user.username;
        const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
        const isAdmin = adminUsername && currentUsername === adminUsername;

        if (!isAdmin) {
            return res.status(403).json({ error: '权限不足' });
        }

        const { module } = req.query;
        const query = {};
        if (module) query.module = module;

        const contents = await Content.find(query).sort({ createdAt: -1 });
        res.json({ success: true, contents });
    } catch (e) {
        console.error('Get All Content Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin: Delete Content
router.delete('/admin/content/:id', authenticate, async (req, res) => {
    try {
        const currentUsername = req.user.username;
        const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : null;
        const isAdmin = adminUsername && currentUsername === adminUsername;

        if (!isAdmin) {
            return res.status(403).json({ error: '权限不足' });
        }

        await Content.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete Content Error:', e);
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
