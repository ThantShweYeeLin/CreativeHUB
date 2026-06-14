import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const mongoUri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/creativehub';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (_req, res) => {
  res.send({ status: 'ok', service: 'CreativeHUB backend' });
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });
