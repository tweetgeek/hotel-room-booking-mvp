import type { Knex } from 'knex';

// SQL views are the only read contract for query handlers (ADR-005, constitution IV)
export async function up(db: Knex): Promise<void> {
  await db.raw(`
    CREATE OR REPLACE VIEW v_room_card AS
    SELECT id, name, description, features, price_per_night, currency, check_in_time, check_out_time, image_url
    FROM rooms
  `);
  await db.raw(`
    CREATE OR REPLACE VIEW v_room_blocked_nights AS
    SELECT room_id, night, reservation_id, status
    FROM rm_room_nights
  `);
  await db.raw(`
    CREATE OR REPLACE VIEW v_reservation_status AS
    SELECT id, status, rejection_reason
    FROM rm_reservations
  `);
  await db.raw(`
    CREATE OR REPLACE VIEW v_reservation_details AS
    SELECT r.id, r.room_id, rm.name AS room_name, rm.check_in_time, rm.check_out_time,
           r.check_in, r.check_out, r.nights, r.guest_name, r.guest_email,
           r.total_amount, r.currency, r.status, r.rejection_reason, r.refund_amount,
           r.payment_id, r.created_at, r.updated_at
    FROM rm_reservations r
    JOIN rooms rm ON rm.id = r.room_id
  `);
  await db.raw(`
    CREATE OR REPLACE VIEW v_reservation_timeline AS
    SELECT reservation_id, position, event_type, occurred_at, reason
    FROM rm_reservation_timeline
    ORDER BY position
  `);
}

export async function down(db: Knex): Promise<void> {
  for (const view of [
    'v_reservation_timeline',
    'v_reservation_details',
    'v_reservation_status',
    'v_room_blocked_nights',
    'v_room_card',
  ]) {
    await db.raw(`DROP VIEW IF EXISTS ${view}`);
  }
}
