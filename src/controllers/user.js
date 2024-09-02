const DB = require("../DB");

const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");

const logUserIn = (req, res, handleErr) => {
  const username = req.body.username;
  const password = req.body.password;

  // Check if the user exists
  DB.update();
  const user = DB.users.find((user) => user.username === username);

  // Check the password if the user was found
  if (user && user.password === password) {
    // At this point, we know that the client is who they say they are

    // Generate a random 10 digit token
    const token = Math.floor(Math.random() * 10000000000).toString();

    // Save the generated token
    DB.sessions.push({ userId: user.id, token: token });
    DB.save();

    res.setHeader("Set-Cookie", `token=${token}; Path=/;`);
    res.status(200).json({ message: "Logged in successfully!" });
  } else {
    return handleErr({ status: 401, message: "Invalid username or password." });
  }
};

const logUserOut = (req, res) => {
  // Remove the session object form the DB SESSIONS array
  DB.update();
  const sessionIndex = DB.sessions.findIndex(
    (session) => session.userId === req.userId
  );
  if (sessionIndex > -1) {
    DB.sessions.splice(sessionIndex, 1);
    DB.save();
  }
  res.setHeader(
    "Set-Cookie",
    `token=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
  res.status(200).json({ message: "Logged out successfully!" });
};

const sendUserInfo = (req, res) => {
  DB.update();
  const user = DB.users.find((user) => user.id === req.userId);
  res.json({ username: user.username, name: user.name });
};

const updateUser = (req, res) => {
  const username = req.body.username;
  const name = req.body.name;
  const password = req.body.password;

  // Grab the user object that is currently logged in
  DB.update();
  const user = DB.users.find((user) => user.id === req.userId);

  user.username = username;
  user.name = name;

  // Only update the password if it is provided
  if (password) {
    user.password = password;
  }

  DB.save();

  res.status(200).json({
    username: user.username,
    name: user.name,
    password_status: password ? "updated" : "not updated",
  });
};

const uploadVideo = async (req, res, handleErr) => {
  const filename = req.headers.filename;
  const extension = path.extname(filename).substring(1).toLowerCase();
  const name = path.parse(filename).name;
  const videoId = crypto.randomBytes(4).toString("hex");
  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullpath = `./storage/${videoId}/original.${extension}`;
    const file = await fs.open(fullpath, "w");
    const fileStream = file.createWriteStream();
    await pipeline(req, fileStream);
    DB.update();
    DB.videos.unshift({
      id: DB.videos.length,
      videoId,
      name,
      extension,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });
    DB.save();

    res.status(201).json({
      status: "success",
      message: "The file was uploaded successfully!",
    });
  } catch (error) {
    await util.deleteFolder(`./storage/${videoId}`);
    if (error.code !== "ECONNRESET") return handleErr(error);
  }
};

const controller = {
  logUserIn,
  logUserOut,
  sendUserInfo,
  updateUser,
  uploadVideo,
};

module.exports = controller;
