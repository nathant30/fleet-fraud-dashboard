/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('insurance_policies', function(table) {
    table.increments('id').primary();
    
    // Foreign key to companies
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    
    // Policy identification
    table.string('policy_number', 100).notNullable().unique();
    table.string('provider', 255).notNullable();
    table.enu('policy_type', ['comprehensive', 'liability', 'collision', 'cargo']).notNullable();
    
    // Financial details
    table.decimal('coverage_amount', 15, 2).notNullable();
    table.decimal('deductible', 10, 2).defaultTo(0.00);
    table.decimal('premium_amount', 10, 2).notNullable();
    
    // Policy period
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.enu('status', ['active', 'expired', 'cancelled', 'suspended']).defaultTo('active');
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['company_id']);
    table.index(['policy_number']);
    table.index(['provider']);
    table.index(['policy_type']);
    table.index(['status']);
    table.index(['start_date', 'end_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('insurance_policies');
};