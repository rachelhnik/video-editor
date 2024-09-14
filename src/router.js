// Controllers
const User = require("./controllers/user");
const Video = require("./controllers/videos");

module.exports = (server) => {
  // ------------------------------------------------ //
  // ************ USER ROUTES ************* //
  // ------------------------------------------------ //

  // Log a user in and give them a token
  server.route("post", "/api/login", User.logUserIn);

  // Log a user out
  server.route("delete", "/api/logout", User.logUserOut);

  // Send user info
  server.route("get", "/api/user", User.sendUserInfo);

  // Update a user info
  server.route("put", "/api/user", User.updateUser);

  //Get videos
  server.route("get", "/api/videos", Video.getVideos);

  //Upload video
  server.route("post", "/api/upload-video", Video.uploadVideo);

  server.route("patch", "/api/video/extract-audio", Video.extractAudio);

  server.route("put", "/api/video/resize", Video.resizeVideo);

  server.route("get", "/get-video-asset", Video.getVideoAsset);
};
