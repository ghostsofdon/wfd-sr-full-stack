import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Reset data before seeding
  await prisma.$executeRawUnsafe('TRUNCATE properties CASCADE;');

  const sql = `
WITH property_data AS (
  INSERT INTO properties (name, address, city, state, zip_code, status)
  VALUES ('Park Meadows Apartments', '123 Main St', 'Denver', 'CO', '80206', 'active')
  RETURNING id
),
unit_type_data AS (
  INSERT INTO unit_types (property_id, name, bedrooms, bathrooms, square_footage)
  SELECT id, '1BR/1BA', 1, 1, 700
  FROM property_data
  RETURNING id, property_id
),
units_data AS (
  INSERT INTO units (property_id, unit_type_id, unit_number, floor, status)
  SELECT
    ut.property_id,
    ut.id,
    (100 + gs.n)::text,
    FLOOR(gs.n / 10) + 1,
    'occupied'
  FROM unit_type_data ut
  CROSS JOIN generate_series(1, 20) AS gs(n)
  RETURNING id, property_id, unit_type_id, unit_number
),
unit_pricing_data AS (
  INSERT INTO unit_pricing (unit_id, base_rent, market_rent, effective_date)
  SELECT id, 1600, 1600, '2025-01-02'::date
  FROM units_data
  RETURNING unit_id
),
-- Scenario 1: High risk - lease expires in 45 days, no renewal offer, paying on time
resident_1 AS (
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status)
  SELECT property_id, id, 'Jane', 'Doe', 'jane.doe@example.com', 'active'
  FROM units_data WHERE unit_number = '101'
  RETURNING id, property_id, unit_id
),
lease_1 AS (
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, lease_type, status)
  SELECT property_id, id, unit_id, '2023-01-15', '2025-01-02'::date + INTERVAL '45 days', 1400, 'fixed', 'active'
  FROM resident_1
  RETURNING id, property_id, resident_id
),
payments_1 AS (
  INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date)
  SELECT
    r.property_id,
    r.id,
    'payment',
    'rent',
    1400,
    '2025-01-02'::date - INTERVAL '1 month' * (6 - gs.n)
  FROM resident_1 r
  CROSS JOIN generate_series(0, 5) AS gs(n)
  RETURNING id
),
-- Scenario 2: Medium risk - lease expires in 60 days, missed one payment
resident_2 AS (
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status)
  SELECT property_id, id, 'John', 'Smith', 'john.smith@example.com', 'active'
  FROM units_data WHERE unit_number = '102'
  RETURNING id, property_id, unit_id
),
lease_2 AS (
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, lease_type, status)
  SELECT property_id, id, unit_id, '2023-01-15', '2025-01-02'::date + INTERVAL '60 days', 1500, 'fixed', 'active'
  FROM resident_2
  RETURNING id, property_id, resident_id
),
payments_2 AS (
  INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date)
  SELECT
    r.property_id,
    r.id,
    'payment',
    'rent',
    1500,
    '2025-01-02'::date - INTERVAL '1 month' * (6 - gs.n)
  FROM resident_2 r
  CROSS JOIN generate_series(0, 4) AS gs(n) -- Only 5 payments (1 missed)
  RETURNING id
),
-- Scenario 3: Low risk - 6 months left on lease, renewal offer sent
resident_3 AS (
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status)
  SELECT property_id, id, 'Alice', 'Johnson', 'alice.johnson@example.com', 'active'
  FROM units_data WHERE unit_number = '103'
  RETURNING id, property_id, unit_id
),
lease_3 AS (
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, lease_type, status)
  SELECT property_id, id, unit_id, '2023-06-15', '2025-01-02'::date + INTERVAL '180 days', 1600, 'fixed', 'active'
  FROM resident_3
  RETURNING id, property_id, resident_id
),
payments_3 AS (
  INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date)
  SELECT
    r.property_id,
    r.id,
    'payment',
    'rent',
    1600,
    '2025-01-02'::date - INTERVAL '1 month' * (6 - gs.n)
  FROM resident_3 r
  CROSS JOIN generate_series(0, 5) AS gs(n)
  RETURNING id
),
renewal_3 AS (
  INSERT INTO renewal_offers (property_id, resident_id, lease_id, renewal_start_date, renewal_end_date, proposed_rent, status)
  SELECT
    l.property_id,
    l.resident_id,
    l.id,
    '2025-01-02'::date + INTERVAL '180 days',
    '2025-01-02'::date + INTERVAL '545 days',
    1650,
    'pending'
  FROM lease_3 l
  RETURNING id
),
-- Scenario 4: High risk - Month-to-month
resident_4 AS (
  INSERT INTO residents (property_id, unit_id, first_name, last_name, email, status)
  SELECT property_id, id, 'Bob', 'Williams', 'bob.williams@example.com', 'active'
  FROM units_data WHERE unit_number = '104'
  RETURNING id, property_id, unit_id
),
lease_4 AS (
  INSERT INTO leases (property_id, resident_id, unit_id, lease_start_date, lease_end_date, monthly_rent, lease_type, status)
  SELECT property_id, id, unit_id, '2024-12-01', '2025-01-01', 1450, 'month_to_month', 'active'
  FROM resident_4
  RETURNING id, property_id, resident_id
),
payments_4 AS (
  INSERT INTO resident_ledger (property_id, resident_id, transaction_type, charge_code, amount, transaction_date)
  SELECT
    r.property_id,
    r.id,
    'payment',
    'rent',
    1450,
    '2025-01-02'::date - INTERVAL '1 month' * (6 - gs.n)
  FROM resident_4 r
  CROSS JOIN generate_series(0, 5) AS gs(n)
  RETURNING id
)
SELECT id as result FROM property_data;
  `;

  const results = await prisma.$queryRawUnsafe<{ result: string }[]>(sql);
  const propertyId = results[0].result;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { units: true }
  });

  if (!property) throw new Error('Property not found');

  const BASE_DATE = new Date('2025-01-02T12:00:00Z');

  const addExtra = async (unitIndex: number, type: 'high' | 'medium' | 'low') => {
    const targetUnitName = (105 + unitIndex).toString();
    const unit = property.units.find(u => u.unitNumber === targetUnitName)!;
    const resident = await prisma.resident.create({
      data: { propertyId, unitId: unit.id, firstName: 'Extra', lastName: 'Resident ' + unitIndex, status: 'active' }
    });

    let daysEnd = 180;
    let rent = 1600;

    if (type === 'high') { daysEnd = 25; rent = 1400; }
    else if (type === 'medium') { daysEnd = 60; rent = 1600; }

    const endDate = new Date(BASE_DATE);
    endDate.setDate(endDate.getDate() + daysEnd);

    const lease = await prisma.lease.create({
      data: { propertyId, residentId: resident.id, unitId: unit.id, leaseStartDate: new Date('2024-01-01'), leaseEndDate: endDate, monthlyRent: rent, leaseType: 'fixed', status: 'active' }
    });

    for (let j = 0; j < 6; j++) {
      const paymentDate = new Date(BASE_DATE);
      paymentDate.setMonth(paymentDate.getMonth() - j);
      await prisma.residentLedger.create({
        data: { propertyId, residentId: resident.id, transactionType: 'payment', chargeCode: 'rent', amount: rent, transactionDate: paymentDate }
      });
    }
  };

  await addExtra(0, 'high');
  await addExtra(1, 'high');
  await addExtra(2, 'medium');
  await addExtra(3, 'medium');
  await addExtra(4, 'medium');
  for (let i = 5; i < 11; i++) await addExtra(i, 'low');

  console.log(`
Seed complete (with exact matches)!
Property ID: ${propertyId.slice(0, 8)}...
Full Property ID: ${propertyId}
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
