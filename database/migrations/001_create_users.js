/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    // Primary key - use increments() for cross-database compatibility
    table.increments('id').primary();
    
    // User credentials and info
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    
    // Role with check constraint (supported in PostgreSQL, ignored in SQLite)
    table.enu('role', ['admin', 'manager', 'analyst', 'viewer']).defaultTo('analyst');
    
    // Status and activity tracking
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login_at').nullable();
    
    // Timestamps - use timestamp() for cross-database compatibility
    table.timestamps(true, true); // created_at, updated_at with defaults
    
    // Indexes
    table.index(['email']);
    table.index(['role']);
    table.index(['is_active']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('users');
};