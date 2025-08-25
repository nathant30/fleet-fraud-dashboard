/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('maintenance_records', function(table) {
    table.increments('id').primary();
    
    // Foreign key to vehicles
    table.integer('vehicle_id').unsigned().notNullable();
    table.foreign('vehicle_id').references('vehicles.id').onDelete('CASCADE');
    
    // Service details
    table.date('service_date').notNullable();
    table.string('service_type', 100).notNullable();
    table.text('description');
    table.decimal('cost', 10, 2).notNullable();
    table.integer('mileage_at_service');
    table.string('service_provider', 255);
    table.date('next_service_date');
    
    // Timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['vehicle_id']);
    table.index(['service_date']);
    table.index(['service_type']);
    table.index(['next_service_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('maintenance_records');
};