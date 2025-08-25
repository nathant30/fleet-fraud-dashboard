/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.increments('id').primary();
    
    // User reference
    table.integer('user_id').unsigned().nullable();
    table.foreign('user_id').references('users.id').onDelete('SET NULL');
    
    // Action details
    table.string('action', 50).notNullable();
    table.string('table_name', 100).notNullable();
    table.integer('record_id').notNullable();
    
    // Change tracking (JSON strings)
    table.text('old_values').nullable(); // JSON string of old values
    table.text('new_values').nullable(); // JSON string of new values
    
    // Request metadata
    table.string('ip_address', 45).nullable();
    table.text('user_agent').nullable();
    
    // Timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['action']);
    table.index(['table_name', 'record_id']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};