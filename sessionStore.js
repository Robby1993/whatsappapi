// Centralized store for WhatsApp sessions to prevent circular dependencies
const sessions = {};
const sessionStatus = {};
const loggingOut = {};

module.exports = {
  sessions,
  sessionStatus,
  loggingOut
};
