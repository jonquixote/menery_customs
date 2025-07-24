const mockAuth = {
  authenticateAdmin: jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    if (token === 'invalid-token') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = { id: 1, role: 'admin' };
    next();
  }),
  authenticateUser: jest.fn((req, res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  })
};

module.exports = mockAuth;
