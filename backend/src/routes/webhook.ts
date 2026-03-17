import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { deliverWebhook } from '../services/webhookDelivery';

export const webhookRouter = Router();

// ─── GET /api/v1/properties/:propertyId/webhooks ─────────────────────────────
const WebhookListSchema = z.object({
  status: z.enum(['pending', 'delivered', 'failed', 'dlq']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const webhookQueryArgs = {
  include: {
    resident: { select: { firstName: true, lastName: true } },
    deadLetter: { select: { reason: true, movedAt: true } },
  },
} as const;
type LogWithRelations = Awaited<
  ReturnType<typeof prisma.webhookDeliveryLog.findMany<typeof webhookQueryArgs>>
>[number];

webhookRouter.get(
  '/properties/:propertyId/webhooks',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const propertyId = req.params['propertyId'] as string;
      const query = WebhookListSchema.parse(req.query);

      const property = await prisma.property.findUnique({ where: { id: propertyId } });
      if (!property) {
        return next(createError(`Property ${propertyId} not found`, 404, 'PROPERTY_NOT_FOUND'));
      }

      const [logs, total] = await Promise.all([
        prisma.webhookDeliveryLog.findMany({
          where: {
            propertyId,
            ...(query.status ? { status: query.status } : {}),
          },
          orderBy: { createdAt: 'desc' },
          skip: query.offset,
          take: query.limit,
          include: {
            resident: { select: { firstName: true, lastName: true } },
            deadLetter: { select: { reason: true, movedAt: true } },
          },
        }) as Promise<LogWithRelations[]>,
        prisma.webhookDeliveryLog.count({
          where: {
            propertyId,
            ...(query.status ? { status: query.status } : {}),
          },
        }),
      ]);

      const resolvedLogs = await logs;

      return res.json({
        property_id: propertyId,
        total,
        limit: query.limit,
        offset: query.offset,
        results: resolvedLogs.map((l: LogWithRelations) => ({
          id: l.id,
          event_id: l.eventId,
          resident_id: l.residentId,
          resident_name: `${l.resident.firstName} ${l.resident.lastName}`,
          event_type: l.eventType,
          status: l.status,
          attempt_count: l.attemptCount,
          last_attempt_at: l.lastAttemptAt,
          next_retry_at: l.nextRetryAt,
          rms_response_status: l.rmsResponseStatus,
          created_at: l.createdAt,
          dlq_reason: l.deadLetter?.reason ?? null,
        })),
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ─── POST /api/v1/webhooks/:webhookId/retry ───────────────────────────────────
webhookRouter.post(
  '/webhooks/:webhookId/retry',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookId = req.params['webhookId'] as string;

      const webhook = await prisma.webhookDeliveryLog.findUnique({ where: { id: webhookId } });
      if (!webhook) {
        return next(createError(`Webhook ${webhookId} not found`, 404, 'NOT_FOUND'));
      }

      if (webhook.status === 'delivered') {
        return res.status(200).json({ message: 'Already delivered — no retry needed' });
      }

      // Reset to pending and allow immediate retry (bypass backoff)
      await prisma.webhookDeliveryLog.update({
        where: { id: webhookId },
        data: {
          status: 'pending',
          nextRetryAt: new Date(),
          attemptCount: 0,
        },
      });

      // Remove from DLQ if present
      await prisma.webhookDeadLetterQueue
        .delete({ where: { webhookDeliveryLogId: webhookId } })
        .catch(() => {});

      // Trigger immediate delivery asynchronously
      deliverWebhook(webhookId).catch((err: unknown) =>
        console.error('[manual-retry] delivery error:', err)
      );

      return res.status(202).json({ message: 'Retry queued', webhook_id: webhookId });
    } catch (err) {
      return next(err);
    }
  }
);
