const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('users').del();
  
  // Generate password hashes
  const adminPassword = await bcrypt.hash('admin123', 12);
  const managerPassword = await bcrypt.hash('manager123', 12);
  const analystPassword = await bcrypt.hash('analyst123', 12);

  // Insert seed entries
  await knex('users').insert([
    {
      id: 1,
      email: 'admin@fleetfraud.com',
      password_hash: adminPassword,
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      email: 'manager@fleetfraud.com',
      password_hash: managerPassword,
      first_name: 'Fleet',
      last_name: 'Manager',
      role: 'manager',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      email: 'analyst@fleetfraud.com',
      password_hash: analystPassword,
      first_name: 'Fraud',
      last_name: 'Analyst',
      role: 'analyst',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};