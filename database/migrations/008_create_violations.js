/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('violations', function(table) {
    table.increments('id').primary();
    
    // Foreign keys
    table.integer('driver_id').unsigned().notNullable();
    table.foreign('driver_id').references('drivers.id').onDelete('CASCADE');
    
    table.integer('vehicle_id').unsigned().nullable();
    table.foreign('vehicle_id').references('vehicles.id').onDelete('SET NULL');
    
    // Violation details
    table.date('violation_date').notNullable();
    table.string('violation_type', 100).notNullable();
    table.text('description');
    table.decimal('fine_amount', 8, 2).defaultTo(0.00);
    table.integer('points').defaultTo(0);
    table.text('location');
    table.string('citation_number', 100);
    table.enu('status', ['active', 'resolved', 'dismissed', 'pending']).defaultTo('active');
    
    // Timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['driver_id']);
    table.index(['vehicle_id']);
    table.index(['violation_date']);
    table.index(['violation_type']);
    table.index(['status']);
    table.index(['citation_number']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('violations');
};