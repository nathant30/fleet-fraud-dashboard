/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('vehicles', function(table) {
    table.increments('id').primary();
    
    // Foreign key to companies
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    
    // Vehicle identification
    table.string('vin', 17).notNullable().unique();
    table.string('license_plate', 20);
    
    // Vehicle details
    table.string('make', 100).notNullable();
    table.string('model', 100).notNullable();
    table.integer('year').notNullable();
    table.enu('vehicle_type', ['truck', 'van', 'car', 'motorcycle', 'trailer', 'other']).notNullable();
    table.enu('fuel_type', ['gasoline', 'diesel', 'electric', 'hybrid', 'natural_gas']).defaultTo('gasoline');
    
    // Vehicle metrics
    table.integer('mileage').defaultTo(0);
    table.date('purchase_date');
    table.decimal('purchase_price', 12, 2);
    table.decimal('current_value', 12, 2);
    
    // Status and tracking
    table.enu('status', ['active', 'maintenance', 'retired', 'stolen', 'totaled']).defaultTo('active');
    table.boolean('gps_enabled').defaultTo(false);
    
    // Location tracking
    table.decimal('last_location_lat', 10, 8);
    table.decimal('last_location_lng', 11, 8);
    table.timestamp('last_location_updated');
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['company_id']);
    table.index(['vin']);
    table.index(['license_plate']);
    table.index(['status']);
    table.index(['vehicle_type']);
    table.index(['make', 'model']);
    table.index(['year']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('vehicles');
};