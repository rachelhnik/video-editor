const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");
const FF = require("../../lib/FF");
const DB = require("../DB");
const JobQueue = require("../../lib/JobQueue");

const jobs = new JobQueue();

const getVideos = async (req, res, handleErr) => {
  const videos = DB.videos.filter((video) => video.userId === req.userId);

  res.status(200).json(videos);
};

const uploadVideo = async (req, res, handleErr) => {
  const filename = req.headers.filename;
  const extension = path.extname(filename).substring(1).toLowerCase();
  const name = path.parse(filename).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["mov", "mp4"];

  if (FORMATS_SUPPORTED.indexOf(extension) == -1) {
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: mov, mp4",
    });
  }

  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullpath = `./storage/${videoId}/original.${extension}`;
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;
    const file = await fs.open(fullpath, "w");
    const fileStream = file.createWriteStream();
    await pipeline(req, fileStream);

    await FF.createThumbnail(fullpath, thumbnailPath);

    const dimensions = await FF.generateDimensions(fullpath);

    DB.update();
    DB.videos.unshift({
      id: DB.videos.length,
      videoId,
      name,
      extension,
      dimensions,
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

const getVideoAsset = async (req, res, handleErr) => {
  const videoId = req.params.get("videoId");
  const type = req.params.get("type");

  DB.update();
  const video = DB.videos.find((video) => video.videoId == videoId);

  if (!video) {
    return handleErr({
      status: 404,
      message: "Video not found!",
    });
  }

  let file;
  let mimeType;
  let filename;

  switch (type) {
    case "thumbnail":
      file = await fs.open(`./storage/${videoId}/thumbnail.jpg`, "r");
      mimeType = "image/jpeg";
      break;

    case "audio":
      file = await fs.open(`./storage/${videoId}/audio.aac`, "r");
      mimeType = "audio/aac";
      filename = `${video.name}-audio.aac`;
      break;

    case "resize":
      const dimensions = req.params.get("dimensions");
      file = await fs.open(
        `./storage/${videoId}/${dimensions}.${video.extension}`,
        "r"
      );
      mimeType = "video/mp4"; // Not a good practice! Videos are not always MP4
      filename = `${video.name}-${dimensions}.${video.extension}`;
      break;

    case "original":
      file = await fs.open(
        `./storage/${videoId}/original.${video.extension}`,
        "r"
      );
      mimeType = "video/mp4"; // Not a good practice! Videos are not always MP4
      filename = `${video.name}.${video.extension}`;
      break;
  }

  try {
    const stat = await file.stat();
    const fileStream = file.createReadStream();

    if (type !== "thumbnail") {
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    }

    // Set the Content-Type header based on the file type
    res.setHeader("Content-Type", mimeType);
    // Set the Content-Length to the size of the file
    res.setHeader("Content-Length", stat.size);

    res.status(200);
    await pipeline(fileStream, res);
    file.close();
  } catch (err) {
    console.log("error:", err);
  }
};

const extractAudio = async (req, res, handleErr) => {
  const videoId = req.params.get("videoId");

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);

  if (video.extractedAudio) {
    return handleErr({
      status: 400,
      message: "The audio has already been extracted for this video.",
    });
  }
  const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
  const targetAudioPath = `./storage/${videoId}/audio.aac`;

  try {
    await FF.extractAudio(originalVideoPath, targetAudioPath);

    video.extractedAudio = true;
    DB.save();

    res.status(200).json({
      status: "success",
      message: "The audio was extracted successfully!",
    });
  } catch (err) {
    util.deleteFile(targetAudioPath);
    return handleErr(err);
  }
};

const resizeVideo = async (req, res, handleErr) => {
  const videoId = req.body.videoId;
  const width = Number(req.body.width);
  const height = Number(req.body.height);

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);
  video.resizes[`${width}x${height}`] = { processing: true };
  DB.save();

  jobs.enqueue({
    type: "resize",
    videoId,
    width,
    height,
  });

  res.status(200).json({
    status: "success",
    message: "The video is now being processed!",
  });
};

const controller = {
  getVideos,
  uploadVideo,
  getVideoAsset,
  extractAudio,
  resizeVideo,
};

module.exports = controller;
