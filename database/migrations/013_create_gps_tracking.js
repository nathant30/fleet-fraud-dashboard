/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('gps_tracking', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
    table.uuid('trip_id').references('id').inTable('trips').onDelete('CASCADE');
    table.uuid('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.timestamp('timestamp').notNullable();
    table.text('location').notNullable(); // lat,lng format for SQLite
    table.decimal('speed', 5, 2); // km/h
    table.decimal('heading', 5, 2); // degrees
    table.decimal('altitude', 8, 2); // meters
    table.decimal('accuracy', 5, 2); // meters
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['trip_id']);
    table.index(['vehicle_id']);
    table.index(['timestamp']);
    table.index(['timestamp', 'vehicle_id']); // Composite index for time-based vehicle queries
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('gps_tracking');
};