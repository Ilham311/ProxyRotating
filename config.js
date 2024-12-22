// config.js
module.exports = {
  MAX_RETRIES: process.env.MAX_RETRIES || 7,
  PORT: process.env.PORT || 3000,
  TIMEOUT: process.env.TIMEOUT || 10000,
};
