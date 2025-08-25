/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('vehicles').del();

  // Insert seed entries
  await knex('vehicles').insert([
    {
      id: 1,
      company_id: 1,
      vin: '1HGBH41JXMN109186',
      license_plate: 'IL-FL001',
      make: 'Freightliner',
      model: 'Cascadia',
      year: 2020,
      vehicle_type: 'truck',
      fuel_type: 'diesel',
      mileage: 85000,
      purchase_date: '2020-03-15',
      purchase_price: 125000.00,
      current_value: 95000.00,
      status: 'active',
      gps_enabled: true,
      last_location_lat: 41.8781,
      last_location_lng: -87.6298,
      last_location_updated: knex.fn.now(),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      company_id: 1,
      vin: '2HGBH41JXMN109187',
      license_plate: 'IL-FL002',
      make: 'Peterbilt',
      model: '579',
      year: 2019,
      vehicle_type: 'truck',
      fuel_type: 'diesel',
      mileage: 120000,
      purchase_date: '2019-08-20',
      purchase_price: 135000.00,
      current_value: 85000.00,
      status: 'active',
      gps_enabled: true,
      last_location_lat: 41.8781,
      last_location_lng: -87.6298,
      last_location_updated: knex.fn.now(),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      company_id: 2,
      vin: '3HGBH41JXMN109188',
      license_plate: 'TX-EF001',
      make: 'Volvo',
      model: 'VNL',
      year: 2021,
      vehicle_type: 'truck',
      fuel_type: 'diesel',
      mileage: 45000,
      purchase_date: '2021-01-10',
      purchase_price: 140000.00,
      current_value: 120000.00,
      status: 'active',
      gps_enabled: true,
      last_location_lat: 29.7604,
      last_location_lng: -95.3698,
      last_location_updated: knex.fn.now(),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 4,
      company_id: 3,
      vin: '4HGBH41JXMN109189',
      license_plate: 'FL-ST001',
      make: 'International',
      model: 'LT',
      year: 2018,
      vehicle_type: 'truck',
      fuel_type: 'diesel',
      mileage: 180000,
      purchase_date: '2018-06-05',
      purchase_price: 110000.00,
      current_value: 65000.00,
      status: 'maintenance',
      gps_enabled: false,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};