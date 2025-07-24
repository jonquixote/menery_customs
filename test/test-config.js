// Test database configuration
module.exports = {
  // Use SQLite in-memory database for testing
  test: {
    username: 'test',
    password: null,
    database: 'test_db',
    host: 'localhost',
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  
  // Mock services for testing
  services: {
    email: {
      sendOrderConfirmation: jest.fn().mockResolvedValue(true),
      sendNewOrderAlert: jest.fn().mockResolvedValue(true),
      sendOrderComplete: jest.fn().mockResolvedValue(true)
    }
  }
};
