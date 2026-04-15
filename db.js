const { Sequelize } = require("sequelize");
require("dotenv").config();

// Render External URLs require SSL.
// We enable it if the URL contains 'render.com'
const isRender = process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: isRender ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

module.exports = sequelize;
