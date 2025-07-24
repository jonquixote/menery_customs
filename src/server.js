const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { sequelize, testDbConnection } = require('./models');

const app = express();
const PORT = process.env.PORT || 3001; // Default to 3001 for development

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://js.squareupsandbox.com", "https://squareup.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://js.squareupsandbox.com", `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`, "https://squareup.com"],
    },
  },
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : `http://localhost:${PORT}`,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Webhook handlers must be defined before other body-parsing middleware
// to use a raw body parser for signature verification.
app.post('/api/webhooks/square', 
  express.raw({ type: 'application/json' }), 
  require('./controllers/webhookController').handleSquareWebhook
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/square', require('./routes/square'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/uploads'));

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
      console.error('Failed to connect to the database');
      process.exit(1);
    }
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('Database synchronized');
  } catch (error) {
    console.error('Database synchronization error:', error);
    process.exit(1);
  }
};

// Start the server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${server.address().port}`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server only if this file is run directly (e.g., `node src/server.js`)
if (require.main === module) {
  startServer();
}

// Export the app for testing purposes
module.exports = app;
