const bcrypt = require("bcryptjs");

const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, 10);
};

const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword,
};