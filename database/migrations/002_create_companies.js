/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('companies', function(table) {
    table.increments('id').primary();
    
    // Company basic info
    table.string('name', 255).notNullable();
    table.string('registration_number', 100).unique();
    table.string('contact_email', 255);
    table.string('contact_phone', 50);
    
    // Address information
    table.text('address');
    table.string('city', 100);
    table.string('state', 100);
    table.string('zip_code', 20);
    table.string('country', 100).defaultTo('US');
    
    // Status and risk assessment
    table.enu('status', ['active', 'suspended', 'investigation', 'inactive']).defaultTo('active');
    table.decimal('risk_score', 5, 2).defaultTo(0.00);
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['name']);
    table.index(['registration_number']);
    table.index(['status']);
    table.index(['risk_score']);
    table.index(['country']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('companies');
};