const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const { sequelize, testDbConnection } = require('./models');

const app = express();
const PORT = process.env.PORT || 3001; // Default to 3001 for development

// Trust the Vercel proxy
app.set('trust proxy', 1);

// Import AdminController and authentication middleware
const AdminController = require('./controllers/adminController');
const { authenticateAdmin } = require('./middleware/auth');

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.paypal.com", "https://cdn.tailwindcss.com", "https://js.squareupsandbox.com", "https://squareup.com", "https://js.paypal.com", "https://sandbox.web.squarecdn.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://sandbox.web.squarecdn.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://sandbox.web.squarecdn.com"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://sandbox.web.squarecdn.com"],
      childSrc: ["'self'", "https://sandbox.web.squarecdn.com"],
      connectSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://js.squareupsandbox.com",
        "https://sandbox.web.squarecdn.com",
        `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,
        "https://squareup.com",
        "https://api-m.sandbox.paypal.com",
        "https://api-m.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://pci-connect.squareupsandbox.com",
        "https://o160250.ingest.sentry.io"
      ],
    },
  },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (process.env.NODE_ENV === 'production') {
      // Only allow production frontend
      callback(null, 'https://menery-customs.vercel.app');
    } else {
      // Only allow local frontend
      if (!origin || origin.startsWith('http://localhost:3000')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware (must be before routes that need req.body)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload middleware (must be before routes that handle file uploads)
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max file size
  abortOnLimit: true,
  limitHandler: (req, res) => {
    res.status(413).json({ error: 'File size exceeds the 100MB limit' });
  },
  useTempFiles: false, // Store in memory for processing
  tempFileDir: '/tmp/', // Fallback if useTempFiles is true
  createParentPath: true,
  safeFileNames: true,
  preserveExtension: true,
  debug: process.env.NODE_ENV === 'development'
}));

// Webhook handlers must be defined before other body-parsing middleware
// to use a raw body parser for signature verification.
app.use('/api/webhooks', require('./routes/webhooks'));

// API Routes
// Admin routes (token and protected)
app.use('/api/admin', require('./routes/admin'));
// Protected admin routes
app.get('/api/admin/orders', authenticateAdmin, AdminController.getAllOrders);
app.post('/api/admin/orders/:orderId/complete', authenticateAdmin, AdminController.completeOrder);
app.put('/api/admin/orders/:orderId/status', authenticateAdmin, AdminController.updateOrderStatus);

// Other API routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/square', require('./routes/square'));
app.use('/api/upload', require('./routes/uploads'));

// Test routes - only in development
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', require('./routes/test'));
}

// Serve static files from the 'public' folder. This should come after API routes.
app.use(express.static(path.join(__dirname, '../public')));

// For any GET request that doesn't match an API route or a static file,
// serve the main index.html file. This is common for Single Page Applications.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database connection
const connectDB = async () => {
  try {
    // Test the database connection
    const isConnected = await testDbConnection();
    
    if (!isConnected) {
      throw new Error('Failed to connect to the database');
    }
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('Database synchronized');
  } catch (error) {
    console.error('Database synchronization error:', error);
    // Re-throw the error to be handled by the serverless environment
    throw error;
  }
};

// Connect to the database and create admin user
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const initialize = async () => {
  await connectDB();
  const { User } = require('./models');
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail && adminPassword) {
    const { Admin } = require('./models');
    let admin = await Admin.findOne({ where: { email: adminEmail } });
    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await Admin.create({ email: adminEmail, password: hashedPassword, name: 'Admin' });
      console.log('Admin user created.');
    } else if (!(await bcrypt.compare(adminPassword, admin.password))) {
      admin.password = await bcrypt.hash(adminPassword, 10);
      await admin.save();
      console.log('Admin user password updated.');
    }
  }
};


// In a serverless environment, we export the app directly.
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  // Wait for initialization before starting the server
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });
}
