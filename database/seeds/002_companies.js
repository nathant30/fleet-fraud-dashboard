/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('companies').del();

  // Insert seed entries
  await knex('companies').insert([
    {
      id: 1,
      name: 'Metro Logistics LLC',
      registration_number: 'ML001234567',
      contact_email: 'contact@metrologistics.com',
      contact_phone: '(555) 123-4567',
      address: '123 Fleet Street',
      city: 'Chicago',
      state: 'IL',
      zip_code: '60601',
      country: 'US',
      status: 'active',
      risk_score: 2.50,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      name: 'Express Freight Co',
      registration_number: 'EF987654321',
      contact_email: 'info@expressfreight.com',
      contact_phone: '(555) 987-6543',
      address: '456 Transport Ave',
      city: 'Houston',
      state: 'TX',
      zip_code: '77001',
      country: 'US',
      status: 'active',
      risk_score: 1.75,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      name: 'Suspicious Transport Inc',
      registration_number: 'ST555666777',
      contact_email: 'contact@suspicious.com',
      contact_phone: '(555) 555-5555',
      address: '789 Risky Road',
      city: 'Miami',
      state: 'FL',
      zip_code: '33101',
      country: 'US',
      status: 'investigation',
      risk_score: 8.90,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};