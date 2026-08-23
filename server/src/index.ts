import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (_req, res) => {
  res.send({ status: 'ok', service: 'CreativeHUB backend' });
});

// Vercel invokes the exported Express app as a serverless function. Keep the
// listener only for local development; connecting to a database at module load
// time would make every deployment request fail when MongoDB is unavailable.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
