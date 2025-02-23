// Required Packages
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const amqp = require("amqplib");
const Redis = require("ioredis");
const cors = require("cors");
const axios = require("axios");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Redis Connection
const redis = new Redis(process.env.REDIS_URL);
redis.on("error", (err) => console.error("Redis connection error:", err));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}) 
.then(() => console.log("Connected to MongoDB successfully"))
.catch((e) => console.log("MongoDB connection error:", e.message));

// RabbitMQ Connection
let channel;
async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("jobApplications"); 
}
connectRabbitMQ();

// Job Schema & Model
const JobSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  industry: String,
});
const Job = mongoose.model("Job", JobSchema);

// Get All Jobs (With Caching)
app.get("/jobs", async (req, res) => {
  try {
    const cacheKey = "all_jobs";
    const cachedJobs = await redis.get(cacheKey);
    if (cachedJobs) return res.json(JSON.parse(cachedJobs));
    
    const jobs = await Job.find();
    await redis.setex(cacheKey, 3600, JSON.stringify(jobs)); // Cache for 1 hour
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Add a New Job
app.post("/jobs", async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    await redis.del("all_jobs"); // Clear cache when new job is added
    res.json({ message: "Job added successfully", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to add job", details: error.message });
  }
});

// Apply for a Job (RabbitMQ Processing)
app.post("/jobs/:id/apply", async (req, res) => {
  try {
    const { userId } = req.body;
    const jobId = req.params.id;
    channel.sendToQueue("jobApplications", Buffer.from(JSON.stringify({ userId, jobId })));
    res.json({ message: "Job application submitted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to apply for job", details: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Job Service running on port ${PORT}`));

module.exports = app;
