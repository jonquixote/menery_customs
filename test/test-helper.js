const { Sequelize } = require('sequelize');
const path = require('path');

// Set up test database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Import models
const db = require('../src/models');

// Initialize models with test database connection
const initTestDatabase = async () => {
  // Initialize models with test database connection
  await db.sequelize.sync({ force: true });
  
  // Return test database connection and models
  return {
    sequelize,
    ...db,
  };
};

// Clean up test database
const closeTestDatabase = async () => {
  await sequelize.close();
};

module.exports = {
  initTestDatabase,
  closeTestDatabase,
  db,
};
