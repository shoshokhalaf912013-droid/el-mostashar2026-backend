const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const liveRoutes = require('./routes/liveRoutes');
const errorHandler = require('./middlewares/errorHandler');
const apiLimiter = require('./middlewares/rateLimiter');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined'));

// configure CORS
const allowedOrigin = process.env.CLIENT_URL || '*';
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// مسار الجذر الأساسي
app.get('/', (req, res) => {
  res.send('Welcome to the backend API!');
});

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/live', liveRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Backend listening on ${PORT}`));
