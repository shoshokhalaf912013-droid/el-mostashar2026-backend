// path: backend/src/db.js
const knex = require('knex');
const { URL } = require('url');
require('dotenv').config();

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 0, max: 10 }
});

module.exports = db;
