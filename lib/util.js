const fs = require("fs/promises");

const util = {};

util.deleteFile = async (path) => {
  try {
    await fs.unlink(path);
  } catch (e) {}
};

util.deleteFolder = async (path) => {
  try {
    await fs.rm(path, { recursive: true });
  } catch (e) {}
};

module.exports = util;
