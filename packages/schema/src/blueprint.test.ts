import { describe, expect, test } from 'vitest';
import { blueprintManifestSchema } from './blueprint.js';

// The blueprint.json example from architecture section 5.2.
const ticketing = {
  $schema: 'https://scaffoldr.dev/schema/blueprint.json',
  id: 'ticketing',
  name: 'Event Ticketing',
  description: 'Sell tickets, issue QR codes, check guests in.',
  layer: 'next-app',
  defaults: ['ui-shadcn', 'auth-better-auth', 'tickets-qr', 'seo-basics'],
  slots: {
    db: {
      required: true,
      options: ['db-prisma', 'db-drizzle'],
      default: 'db-prisma',
    },
    payments: {
      required: true,
      options: [
        'payments-paystack',
        'payments-flutterwave',
        'payments-monnify',
      ],
      default: 'payments-paystack',
    },
    email: { required: false, options: ['email-resend'] },
    sms: { required: false, options: ['sms-termii'] },
  },
  questions: [
    {
      id: 'eventName',
      type: 'text',
      message: 'Event name?',
      flag: '--event-name',
    },
    {
      id: 'currency',
      type: 'select',
      options: ['NGN', 'GHS', 'KES', 'USD'],
      default: 'NGN',
      flag: '--currency',
    },
  ],
};

describe('blueprintManifestSchema', () => {
  test('parses the ticketing example from architecture section 5.2', () => {
    const result = blueprintManifestSchema.safeParse(ticketing);
    expect(result.success).toBe(true);
  });

  test('rejects a slot default that is not in its options', () => {
    const result = blueprintManifestSchema.safeParse({
      ...ticketing,
      slots: {
        ...ticketing.slots,
        db: {
          required: true,
          options: ['db-prisma', 'db-drizzle'],
          default: 'db-mongo',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  test('rejects a question default that is not in its options', () => {
    const result = blueprintManifestSchema.safeParse({
      ...ticketing,
      questions: [
        {
          id: 'currency',
          type: 'select',
          options: ['NGN', 'GHS'],
          default: 'USD',
          flag: '--currency',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a manifest without a layer', () => {
    const { layer, ...withoutLayer } = ticketing;
    expect(blueprintManifestSchema.safeParse(withoutLayer).success).toBe(false);
  });

  test('rejects a question type outside text, select and confirm', () => {
    const result = blueprintManifestSchema.safeParse({
      ...ticketing,
      questions: [{ id: 'x', type: 'number', flag: '--x' }],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a question flag that is not a long flag', () => {
    const result = blueprintManifestSchema.safeParse({
      ...ticketing,
      questions: [{ id: 'x', type: 'text', flag: 'event-name' }],
    });
    expect(result.success).toBe(false);
  });
});
