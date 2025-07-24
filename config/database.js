const path = require('path');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV !== 'production';

const commonConfig = {
  define: {
    timestamps: true,
    underscored: true,
  },
  logging: isDev ? console.log : false,
};

const development = {
  ...commonConfig,
  dialect: 'sqlite',  // Use SQLite for development
  storage: path.join(__dirname, '../database.sqlite'),
  logging: console.log,
};

const test = {
  ...commonConfig,
  dialect: 'sqlite',  // Use SQLite for testing
  storage: ':memory:',
  logging: false,
};

const production = {
  ...commonConfig,
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
};

module.exports = {
  development,
  test,
  production,
};
