/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('insurance_claims', function(table) {
    table.increments('id').primary();
    
    // Foreign keys
    table.integer('policy_id').unsigned().notNullable();
    table.foreign('policy_id').references('insurance_policies.id').onDelete('CASCADE');
    
    table.integer('company_id').unsigned().notNullable();
    table.foreign('company_id').references('companies.id').onDelete('CASCADE');
    
    table.integer('vehicle_id').unsigned().nullable();
    table.foreign('vehicle_id').references('vehicles.id').onDelete('SET NULL');
    
    table.integer('driver_id').unsigned().nullable();
    table.foreign('driver_id').references('drivers.id').onDelete('SET NULL');
    
    // Claim identification
    table.string('claim_number', 100).notNullable().unique();
    
    // Incident details
    table.date('incident_date').notNullable();
    table.date('reported_date').notNullable();
    table.enu('claim_type', ['accident', 'theft', 'vandalism', 'natural_disaster', 'mechanical', 'cargo_loss']).notNullable();
    
    // Financial details
    table.decimal('claim_amount', 15, 2).notNullable();
    table.decimal('settled_amount', 15, 2).nullable();
    
    // Status and processing
    table.enu('status', ['open', 'investigating', 'approved', 'denied', 'settled', 'closed']).defaultTo('open');
    
    // Fraud detection
    table.boolean('fraud_flag').defaultTo(false);
    table.decimal('fraud_score', 5, 2).defaultTo(0.00);
    table.text('fraud_reasons');
    
    // Additional details
    table.text('incident_location');
    table.text('incident_description');
    table.string('police_report_number', 100);
    table.text('adjuster_notes');
    table.date('settlement_date');
    
    // Timestamps
    table.timestamps(true, true);
    
    // Indexes
    table.index(['policy_id']);
    table.index(['company_id']);
    table.index(['vehicle_id']);
    table.index(['driver_id']);
    table.index(['claim_number']);
    table.index(['status']);
    table.index(['fraud_flag']);
    table.index(['fraud_score']);
    table.index(['claim_type']);
    table.index(['incident_date']);
    table.index(['reported_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('insurance_claims');
};