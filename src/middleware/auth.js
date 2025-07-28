const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware to authenticate admin users
 * Expects a Bearer token in the Authorization header
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[1];

    let decoded;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'c89b8e5a6a3b4c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d';
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Support admin JWTs (payload: { user: { id: 'admin', role: 'admin' } })
    if (decoded && decoded.user && decoded.user.role === 'admin') {
      // Optionally, check Admin model for existence
      const { Admin } = require('../models');
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      const admin = await Admin.findOne({ where: { email: adminEmail } });
      if (!admin) {
        return res.status(403).json({ error: 'Admin not found' });
      }
      req.user = { id: 'admin', role: 'admin', email: adminEmail };
      return next();
    }

    // Fallback: legacy user-based admin (if needed)
    const userId = decoded.userId || (decoded.user && decoded.user.userId);
    if (!userId) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    const user = await User.findByPk(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to authenticate regular users
 */
const authenticateUser = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const tokenParts = authHeader.split(' ');
    const token = tokenParts[1];

    try {
      const jwtSecret = process.env.JWT_SECRET || 'c89b8e5a6a3b4c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d';
      // Verify token
      const decoded = jwt.verify(token, jwtSecret);

      // Add user from payload
      req.user = decoded;
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check if user exists
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  authenticateAdmin,
  authenticateUser
};
