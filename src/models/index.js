const { sequelize, Sequelize } = require('../config/sequelize');
const User = require('./User');
const Order = require('./Order');
const AdminModel = require('./Admin');

// Initialize models with Sequelize
const models = {
  User: User(sequelize, Sequelize),
  Order: Order(sequelize, Sequelize),
  Admin: AdminModel(sequelize, Sequelize)
};

// Define associations
Object.values(models)
  .filter(model => typeof model.associate === 'function')
  .forEach(model => model.associate(models));

// Test database connection
const testDbConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  testDbConnection,
  ...models
};
