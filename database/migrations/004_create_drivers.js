/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('drivers', function(table) {
    table.increments('id').primary();
    
    // Foreign key to companies
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    
    // Driver identification
    table.string('driver_license', 50).notNullable().unique();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.date('date_of_birth');
    
    // Contact information
    table.string('phone', 50);
    table.string('email', 255);
    table.text('address');
    
    // Employment and licensing
    table.date('hire_date');
    table.date('license_expiry');
    table.enu('status', ['active', 'suspended', 'terminated', 'on_leave']).defaultTo('active');
    
    // Risk assessment and history
    table.decimal('risk_score', 5, 2).defaultTo(0.00);
    table.integer('total_violations').defaultTo(0);
    table.integer('total_accidents').defaultTo(0);
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['company_id']);
    table.index(['driver_license']);
    table.index(['status']);
    table.index(['risk_score']);
    table.index(['first_name', 'last_name']);
    table.index(['license_expiry']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('drivers');
};