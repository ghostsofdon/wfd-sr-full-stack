import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { renewalRiskRouter } from './routes/renewalRisk';
import { webhookRouter } from './routes/webhook';
import { errorHandler } from './middleware/errorHandler';
import { startRetryWorker } from './workers/retryWorker';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/', healthRouter);
app.use('/api/v1', renewalRiskRouter);
app.use('/api/v1', webhookRouter);

// Global error handler — must be last
app.use(errorHandler);

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
      startRetryWorker();
      console.log('⚙️  Webhook retry worker started');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

main();

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
