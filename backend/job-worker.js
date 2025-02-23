const mongoose = require("mongoose");
const amqp = require("amqplib");
const dotenv = require("dotenv");

dotenv.config();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB successfully"))
.catch((e) => console.log("MongoDB connection error:", e.message));

// Job Applications Schema
const JobApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  appliedAt: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
});
const JobApplication = mongoose.model("JobApplication", JobApplicationSchema);

// RabbitMQ Worker Function
async function startWorker() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue("jobApplications");

    console.log("Job Worker is running and listening for job applications...");

    channel.consume("jobApplications", async (msg) => {
      if (msg !== null) {
        const applicationData = JSON.parse(msg.content.toString());
        console.log("Processing job application:", applicationData);
        
        await JobApplication.updateOne(
          { userId: applicationData.userId, jobId: applicationData.jobId },
          { status: "Processed" },
          { upsert: true }
        );

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("Job Worker failed to start:", error.message);
  }
}

startWorker();
