import { z } from 'zod';
import type { KitchenBoardChange, KitchenBoardItem } from '@/types/kitchenBoard';

const ingredientSchema = z.object({
  ingredientId: z.string(),
  ingredientName: z.string(),
  quantity: z.number(),
  isRemoved: z.boolean(),
  isAddOn: z.boolean(),
});

const itemSchema: z.ZodType<KitchenBoardItem> = z.lazy(() =>
  z.object({
    itemId: z.string(),
    productName: z.string(),
    variationName: z.string().nullable(),
    quantity: z.number(),
    kind: z.string().nullable(),
    specialInstructions: z.string().nullable(),
    ingredients: z.array(ingredientSchema),
    children: z.array(itemSchema),
  }),
);

const changeSchema: z.ZodType<KitchenBoardChange> = z.object({
  kind: z.string(),
  replacementDispatchedOrderId: z.string().nullable(),
  replacementDispatchedOrderNumber: z.string().nullable(),
  previous: itemSchema.nullable(),
  current: itemSchema.nullable(),
});

const orderSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  type: z.string(),
  status: z.string(),
  tableId: z.string().nullable(),
  tableLabel: z.string().nullable(),
  tableNumber: z.number().nullable(),
  serviceSessionId: z.string().nullable(),
  createdAt: z.string(),
  version: z.number().int().positive(),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable(),
  canComplete: z.boolean(),
  requiredKitchenRoutes: z.array(z.object({ target: z.string(), status: z.string() })),
  items: z.array(itemSchema),
});

const correctionSchema = z.object({
  workItemId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  tableId: z.string().nullable(),
  tableLabel: z.string().nullable(),
  tableNumber: z.number().nullable(),
  serviceSessionId: z.string().nullable(),
  amendmentId: z.string().nullable(),
  accountRevision: z.number().nullable(),
  orderVersion: z.number().int().positive(),
  target: z.string().nullable(),
  summary: z.string(),
  withdrawn: z.boolean(),
  isCompleted: z.boolean(),
  canComplete: z.boolean(),
  routeStatus: z.string().nullable(),
  createdAt: z.string(),
  changes: z.array(changeSchema),
});

const completionSchema = z.object({
  orderId: z.string(),
  workItemId: z.string(),
  kind: z.enum(['InitialOrder', 'AmendmentCorrection']),
  accountRevision: z.number().nullable(),
  acknowledgedOrderVersion: z.number().int().positive(),
  sequence: z.number().int().positive(),
  completedAt: z.string(),
});

const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    totalCount: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    removedIds: z.array(z.string()),
    nextCursor: z.string().nullable(),
    watermark: z.number().int().nonnegative(),
    mode: z.enum(['Snapshot', 'Changes', 'Watermark']),
  });

export const kitchenBoardWorkFeedSchema = z.object({
  orders: pageSchema(orderSchema),
  corrections: pageSchema(correctionSchema),
  completions: pageSchema(completionSchema),
});

export const kitchenBoardCompletionResultSchema = completionSchema.extend({ isCompleted: z.literal(true) });
