/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('fuel_transactions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
    table.uuid('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.uuid('driver_id').references('id').inTable('drivers').onDelete('CASCADE');
    table.uuid('trip_id').references('id').inTable('trips').onDelete('SET NULL');
    table.timestamp('transaction_date').notNullable();
    table.text('location'); // lat,lng format for SQLite
    table.decimal('fuel_amount', 8, 2).notNullable(); // liters
    table.decimal('fuel_cost', 10, 2); // currency amount
    table.decimal('odometer_reading', 10, 2);
    table.string('receipt_number', 100);
    table.string('vendor', 255);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['vehicle_id']);
    table.index(['driver_id']);
    table.index(['trip_id']);
    table.index(['transaction_date']);
    table.index(['transaction_date', 'vehicle_id']); // Composite index for fuel analysis
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('fuel_transactions');
};