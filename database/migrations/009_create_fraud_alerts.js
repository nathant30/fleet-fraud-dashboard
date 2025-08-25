/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('fraud_alerts', function(table) {
    table.increments('id').primary();
    
    // Alert classification
    table.enu('alert_type', ['claim_pattern', 'driver_behavior', 'vehicle_anomaly', 'policy_abuse', 'location_inconsistency']).notNullable();
    table.enu('severity', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
    
    // Entity reference
    table.enu('entity_type', ['claim', 'driver', 'vehicle', 'company', 'policy']).notNullable();
    table.integer('entity_id').notNullable();
    
    // Alert details
    table.text('alert_message').notNullable();
    table.text('fraud_indicators');
    table.decimal('risk_score', 5, 2).notNullable();
    
    // Status and assignment
    table.enu('status', ['open', 'investigating', 'resolved', 'false_positive']).defaultTo('open');
    table.integer('assigned_to').unsigned().nullable();
    table.foreign('assigned_to').references('users.id').onDelete('SET NULL');
    
    // Notes and resolution
    table.text('notes');
    table.timestamp('resolved_at').nullable();
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['alert_type']);
    table.index(['severity']);
    table.index(['entity_type', 'entity_id']);
    table.index(['status']);
    table.index(['assigned_to']);
    table.index(['risk_score']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('fraud_alerts');
};