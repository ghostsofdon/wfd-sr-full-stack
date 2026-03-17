/**
 * Scheduled retry worker — polls DB every minute for pending/failed webhooks
 * and retries them using the deliverWebhook function.
 */
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { deliverWebhook } from '../services/webhookDelivery';

const BATCH_SIZE = 20;

async function processPendingWebhooks(): Promise<void> {
  const now = new Date();

  const due = await prisma.webhookDeliveryLog.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: BATCH_SIZE,
    select: { id: true, eventId: true },
  });

  if (due.length === 0) return;

  console.info(`[retry-worker] ${due.length} webhook(s) due for delivery`);

  // Process sequentially to avoid hammering the RMS with burst
  for (const wh of due) {
    try {
      await deliverWebhook(wh.id);
    } catch (err) {
      console.error(`[retry-worker] Unexpected error for ${wh.eventId}:`, err);
    }
  }
}

export function startRetryWorker(): void {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await processPendingWebhooks();
  });
}
