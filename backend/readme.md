# Job Service Microservices API

This repository contains a **microservices-based** backend system for a global job and training recommendation platform. The services include user authentication, job listings, training programs, and a job worker for handling applications asynchronously.

## 🏗️ Tech Stack

- **Node.js** - Backend framework
- **Express.js** - API Routing
- **MongoDB** - Database for storing jobs, users, and training data
- **JWT** - Authentication and authorization
- **RabbitMQ** - Message Queue for async job handling
- **Redis** - Caching for optimized performance
- **Docker & Kubernetes** - Containerization & Orchestration

## 📂 Project Structure

```
📦 project-root
├── job-service.js          # Job-related APIs
├── auth-service.js         # User authentication APIs
├── training-service.js     # Training-related APIs
├── job-worker.js          # Handles job applications via RabbitMQ
├── .env                   # Environment variables (DO NOT COMMIT)
├── package.json           # Dependencies & scripts
├── README.md              # Project documentation
└── docker-compose.yml     # Multi-service containerization
```

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```sh
git clone <YOUR_GITHUB_REPO_URL>
cd project-root
```

### 2️⃣ Install Dependencies
```sh
npm install
```

### 3️⃣ Set Up Environment Variables
Create a `.env` file and configure:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/jobDB
JWT_SECRET=your_secret_key
RABBITMQ_URL=amqp://guest:guest@localhost
REDIS_URL=redis://localhost:6379
```

### 4️⃣ Start Services
```sh
npm run dev
```

## 🐳 Running with Docker
```sh
docker-compose up --build
```

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Register a user
- `POST /auth/login` - Login & get token

### Jobs
- `GET /jobs` - Fetch job listings
- `POST /jobs/apply` - Apply for a job

### Trainings
- `GET /trainings` - Get training programs
- `POST /trainings` - Add new training

## 🎯 Contributing
Feel free to submit issues or PRs to improve this project! 🚀
