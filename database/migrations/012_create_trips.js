/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('trips', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
    table.uuid('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.uuid('driver_id').references('id').inTable('drivers').onDelete('CASCADE');
    table.uuid('route_id').references('id').inTable('routes').onDelete('SET NULL');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time');
    table.text('start_location'); // lat,lng format for SQLite
    table.text('end_location'); // lat,lng format for SQLite
    table.decimal('start_odometer', 10, 2);
    table.decimal('end_odometer', 10, 2);
    table.decimal('distance_traveled', 8, 2);
    table.decimal('fuel_consumed', 8, 2);
    table.string('status', 50).defaultTo('in_progress').checkIn(['in_progress', 'completed', 'cancelled']);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['vehicle_id']);
    table.index(['driver_id']);
    table.index(['route_id']);
    table.index(['start_time']);
    table.index(['status']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('trips');
};