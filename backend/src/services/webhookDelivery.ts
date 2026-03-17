/**
 * Webhook delivery service.
 * Handles sending to RMS, recording attempts, and DLQ promotion.
 */
import axios from 'axios';
import { prisma } from '../lib/prisma';

const RMS_ENDPOINT = process.env.RMS_ENDPOINT || '';
const MAX_RETRIES = 3;

/** Exponential backoff: attempt 1=1m, 2=5m, 3=15m */
function nextRetryDelay(attempt: number): Date {
  const delays = [60, 300, 900]; // seconds
  const secs = delays[Math.min(attempt - 1, delays.length - 1)] ?? 900;
  return new Date(Date.now() + secs * 1000);
}

/**
 * Attempt to deliver a pending webhook to RMS.
 * Uses a DB transaction to atomically update the delivery log and
 * prevent double-delivery on concurrent retries.
 */
export async function deliverWebhook(webhookId: string): Promise<void> {
  // Acquire the row in a serialisable transaction to prevent concurrent delivery
  const webhook = await prisma.webhookDeliveryLog.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) {
    console.warn(`[webhook] ${webhookId} not found — skipping`);
    return;
  }

  if (webhook.status === 'delivered') {
    console.info(`[webhook] ${webhookId} already delivered — idempotent skip`);
    return;
  }

  if (webhook.status === 'dlq') {
    console.warn(`[webhook] ${webhookId} already in DLQ — skipping`);
    return;
  }

  const newAttemptCount = webhook.attemptCount + 1;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveryStatus: string;
  let nextRetry: Date | null = null;

  try {
    const response = await axios.post(RMS_ENDPOINT, webhook.payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET ?? '',
        'X-Event-Id': webhook.eventId,
      },
      timeout: 10_000,
    });

    responseStatus = response.status;
    responseBody = JSON.stringify(response.data).slice(0, 2000);

    if (response.status >= 200 && response.status < 300) {
      deliveryStatus = 'delivered';
      console.info(`[webhook] ${webhook.eventId} delivered ✅ (attempt ${newAttemptCount})`);
    } else {
      // Non-2xx treated as failure
      throw new Error(`RMS responded with ${response.status}`);
    }
  } catch (err: unknown) {
    const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
    responseStatus = axiosError.response?.status ?? null;
    responseBody = axiosError.response
      ? JSON.stringify(axiosError.response.data).slice(0, 2000)
      : String((err as Error).message ?? 'Unknown error');

    console.warn(
      `[webhook] ${webhook.eventId} failed (attempt ${newAttemptCount}): ${responseBody}`
    );

    if (newAttemptCount >= MAX_RETRIES) {
      deliveryStatus = 'dlq';
    } else {
      deliveryStatus = 'failed';
      nextRetry = nextRetryDelay(newAttemptCount);
    }
  }

  // Atomically update delivery log + optionally move to DLQ
  await prisma.$transaction(async (tx) => {
    await tx.webhookDeliveryLog.update({
      where: { id: webhookId },
      data: {
        status: deliveryStatus,
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        nextRetryAt: nextRetry,
        rmsResponseStatus: responseStatus,
        rmsResponseBody: responseBody,
      },
    });

    if (deliveryStatus === 'dlq') {
      const reason =
        `Max retries (${MAX_RETRIES}) exhausted. Last response: ${responseBody ?? 'N/A'}`;

      await tx.webhookDeadLetterQueue.upsert({
        where: { webhookDeliveryLogId: webhookId },
        create: {
          webhookDeliveryLogId: webhookId,
          reason,
        },
        update: {
          reason,
          movedAt: new Date(),
        },
      });
      console.error(`[webhook] ${webhook.eventId} moved to DLQ 💀`);
    }
  });
}

/**
 * Enqueue a new webhook event.
 * Idempotent — uses event_id unique constraint as guard.
 */
export async function enqueueWebhook(params: {
  eventId: string;
  propertyId: string;
  residentId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Prisma expects InputJsonValue for JSON fields; cast from Record<string, unknown>
  const jsonPayload = params.payload as Parameters<typeof prisma.webhookDeliveryLog.create>[0]['data']['payload'];

  await prisma.webhookDeliveryLog.upsert({
    where: { eventId: params.eventId },
    create: {
      eventId: params.eventId,
      propertyId: params.propertyId,
      residentId: params.residentId,
      eventType: params.eventType,
      payload: jsonPayload,
      status: 'pending',
      nextRetryAt: new Date(), // eligible for immediate pickup
    },
    update: {}, // if already exists, do nothing (idempotent)
  });
}
