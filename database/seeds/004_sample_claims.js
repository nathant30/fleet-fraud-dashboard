/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // First, ensure we have the prerequisite data
  
  // Insert drivers
  await knex('drivers').del();
  await knex('drivers').insert([
    {
      id: 1,
      company_id: 1,
      driver_license: 'IL123456789',
      first_name: 'John',
      last_name: 'Smith',
      date_of_birth: '1985-05-15',
      phone: '(555) 111-2222',
      email: 'john.smith@metrologistics.com',
      hire_date: '2020-01-15',
      license_expiry: '2025-05-15',
      status: 'active',
      risk_score: 2.1,
      total_violations: 1,
      total_accidents: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      company_id: 2,
      driver_license: 'TX987654321',
      first_name: 'Maria',
      last_name: 'Garcia',
      date_of_birth: '1990-08-22',
      phone: '(555) 333-4444',
      email: 'maria.garcia@expressfreight.com',
      hire_date: '2021-03-10',
      license_expiry: '2026-08-22',
      status: 'active',
      risk_score: 1.5,
      total_violations: 0,
      total_accidents: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      company_id: 3,
      driver_license: 'FL555666777',
      first_name: 'Suspicious',
      last_name: 'Driver',
      date_of_birth: '1980-12-01',
      phone: '(555) 999-8888',
      email: 'suspicious@suspicious.com',
      hire_date: '2022-01-01',
      license_expiry: '2024-12-01',
      status: 'suspended',
      risk_score: 9.2,
      total_violations: 8,
      total_accidents: 5,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  // Insert insurance policies
  await knex('insurance_policies').del();
  await knex('insurance_policies').insert([
    {
      id: 1,
      company_id: 1,
      policy_number: 'POL-ML-2023-001',
      provider: 'SafeFleet Insurance',
      policy_type: 'comprehensive',
      coverage_amount: 1000000.00,
      deductible: 5000.00,
      premium_amount: 15000.00,
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      status: 'active',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      company_id: 2,
      policy_number: 'POL-EF-2023-002',
      provider: 'TruckGuard Insurance',
      policy_type: 'comprehensive',
      coverage_amount: 1500000.00,
      deductible: 3000.00,
      premium_amount: 18000.00,
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      status: 'active',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      company_id: 3,
      policy_number: 'POL-ST-2023-003',
      provider: 'QuickClaim Insurance',
      policy_type: 'liability',
      coverage_amount: 500000.00,
      deductible: 10000.00,
      premium_amount: 25000.00,
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      status: 'suspended',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  // Clear existing claims
  await knex('insurance_claims').del();

  // Insert sample claims
  await knex('insurance_claims').insert([
    {
      id: 1,
      policy_id: 1,
      company_id: 1,
      vehicle_id: 1,
      driver_id: 1,
      claim_number: 'CLM-2023-001',
      incident_date: '2023-06-15',
      reported_date: '2023-06-16',
      claim_type: 'accident',
      claim_amount: 25000.00,
      settled_amount: 23000.00,
      status: 'settled',
      fraud_flag: false,
      fraud_score: 1.2,
      incident_location: 'I-94 near Chicago, IL',
      incident_description: 'Rear-end collision during traffic jam',
      police_report_number: 'CPD-2023-123456',
      settlement_date: '2023-07-30',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      policy_id: 2,
      company_id: 2,
      vehicle_id: 3,
      driver_id: 2,
      claim_number: 'CLM-2023-002',
      incident_date: '2023-08-10',
      reported_date: '2023-08-10',
      claim_type: 'theft',
      claim_amount: 15000.00,
      status: 'investigating',
      fraud_flag: false,
      fraud_score: 2.8,
      incident_location: 'Houston, TX truck stop',
      incident_description: 'Cargo theft during overnight rest',
      police_report_number: 'HPD-2023-789012',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      policy_id: 3,
      company_id: 3,
      vehicle_id: 4,
      driver_id: 3,
      claim_number: 'CLM-2023-003',
      incident_date: '2023-09-01',
      reported_date: '2023-09-05',
      claim_type: 'accident',
      claim_amount: 85000.00,
      status: 'denied',
      fraud_flag: true,
      fraud_score: 9.5,
      fraud_reasons: 'Multiple red flags: late reporting, inconsistent statements, driver history, vehicle damage inconsistent with reported incident',
      incident_location: 'Remote area near Miami, FL',
      incident_description: 'Single vehicle rollover, total loss',
      adjuster_notes: 'Suspicious circumstances, recommend fraud investigation',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 4,
      policy_id: 3,
      company_id: 3,
      vehicle_id: 4,
      driver_id: 3,
      claim_number: 'CLM-2023-004',
      incident_date: '2023-09-15',
      reported_date: '2023-09-15',
      claim_type: 'vandalism',
      claim_amount: 12000.00,
      status: 'open',
      fraud_flag: true,
      fraud_score: 8.7,
      fraud_reasons: 'Pattern of claims from same driver/vehicle, timing suspicious',
      incident_location: 'Miami, FL',
      incident_description: 'Windows broken, tires slashed',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  // Insert fraud alerts
  await knex('fraud_alerts').del();
  await knex('fraud_alerts').insert([
    {
      id: 1,
      alert_type: 'claim_pattern',
      severity: 'high',
      entity_type: 'driver',
      entity_id: 3,
      alert_message: 'Driver has multiple claims within 30 days',
      fraud_indicators: 'Multiple claims, high dollar amounts, pattern of incidents',
      risk_score: 9.1,
      status: 'open',
      assigned_to: 3,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      alert_type: 'vehicle_anomaly',
      severity: 'medium',
      entity_type: 'vehicle',
      entity_id: 4,
      alert_message: 'Vehicle involved in multiple incidents',
      fraud_indicators: 'High frequency of claims, maintenance issues',
      risk_score: 6.5,
      status: 'investigating',
      assigned_to: 3,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};