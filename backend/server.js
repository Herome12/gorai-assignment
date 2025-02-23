// Required Packages
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const amqp = require("amqplib");
const Redis = require("ioredis");

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

// Middleware for Authentication
const authenticate = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
  }
};

// User Schema & Model
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);

// Job & Training Schema & Model
const JobSchema = new mongoose.Schema({
  title: String,
  company: String,
  location: String,
  industry: String,
});
const TrainingSchema = new mongoose.Schema({
  course_name: String,
  provider: String,
  location: String,
});
const Job = mongoose.model("Job", JobSchema);
const Training = mongoose.model("Training", TrainingSchema);

// Job Applications Schema
const JobApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  appliedAt: { type: Date, default: Date.now },
});
const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);

// Geolocation API to get user location
app.get("/geolocation", async (req, res) => {
  try {
    const response = await axios.get("https://ipinfo.io/json?token=" + process.env.IPINFO_TOKEN);
    res.json({ location: response.data.city });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch location", details: error.message });
  }
});

// Register User
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.json({ message: "User registered successfully", user_id: user._id });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// Login User
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", auth_token: token });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// Get Homepage Content with Redis Caching
app.get("/homepage/content", async (req, res) => {
  try {
    const { location } = req.query;
    const cacheKey = `homepage:${location || "all"}`;
    const cachedData = await redis.get(cacheKey);
    if (cachedData) return res.json(JSON.parse(cachedData));
    
    const jobs = await Job.find(location ? { location } : {}).limit(2);
    const trainings = await Training.find(location ? { location } : {}).limit(2);
    
    const responseData = { jobs, trainings };
    await redis.setex(cacheKey, 3600, JSON.stringify(responseData)); // Cache for 1 hour
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Apply for a Job with RabbitMQ Processing
app.post("/jobs/:id/apply", authenticate, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.userId;
    await JobApplication.create({ userId, jobId });
    channel.sendToQueue("jobApplications", Buffer.from(JSON.stringify({ userId, jobId })));
    res.json({ message: "Job application submitted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to apply for job", details: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export for Docker/Kubernetes
module.exports = app;
