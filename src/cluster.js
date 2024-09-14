const cluster = require("cluster");
const JobQueue = require("../lib/JobQueue.js");

if (cluster.isPrimary) {
  const jobs = new JobQueue();
} else {
  require("./index.js");
}
