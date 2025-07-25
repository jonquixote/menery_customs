const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();
require('pg');

const env = process.env.NODE_ENV || 'development';
const config = require('../../config/database.js')[env];

let sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else if (config.dialect === 'sqlite') {
  // SQLite configuration
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.storage || path.join(__dirname, '../../database.sqlite'),
    logging: config.logging,
    define: config.define
  });
} else {
  // Other databases (PostgreSQL, MySQL, etc.)
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// Test the connection
const testConnection = async () => {
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
  testConnection,
  Sequelize
};
