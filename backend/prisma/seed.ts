/**
 * Prisma seed script — creates realistic test data for Park Meadows Apartments.
 * Run: `npx prisma db seed` (configured via package.json prisma.seed)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Property ────────────────────────────────────────────────────────────────
  const property = await prisma.property.create({
    data: {
      name: 'Park Meadows Apartments',
      address: '123 Main St',
      city: 'Denver',
      state: 'CO',
      zipCode: '80206',
      status: 'active',
    },
  });
  console.log(`  ✓ Property: ${property.name} (${property.id})`);

  // ─── Unit Type ────────────────────────────────────────────────────────────────
  const unitType = await prisma.unitType.create({
    data: {
      propertyId: property.id,
      name: '1BR/1BA',
      bedrooms: 1,
      bathrooms: 1,
      squareFootage: 700,
    },
  });

  // ─── Units (20) ───────────────────────────────────────────────────────────────
  const unitNumbers = Array.from({ length: 20 }, (_, i) => String(101 + i));
  const units: Array<{ id: string; unitNumber: string }> = [];

  for (const unitNumber of unitNumbers) {
    const floor = Math.floor((parseInt(unitNumber) - 101) / 10) + 1;
    const unit = await prisma.unit.create({
      data: {
        propertyId: property.id,
        unitTypeId: unitType.id,
        unitNumber,
        floor,
        status: 'occupied',
      },
    });
    units.push({ id: unit.id, unitNumber: unit.unitNumber });
  }

  // Add pricing to all units (base market rent $1,600)
  for (const unit of units) {
    await prisma.unitPricing.create({
      data: {
        unitId: unit.id,
        baseRent: 1600,
        marketRent: 1680, // 5% above base so rent-gap signal can fire
        effectiveDate: new Date(),
      },
    });
  }
  console.log(`  ✓ ${units.length} units created with pricing`);

  // Helper to get offset date from today
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  };
  const daysAgo = (n: number) => daysFromNow(-n);

  // Helper to add monthly payments
  async function addPayments(
    propertyId: string,
    residentId: string,
    monthlyAmount: number,
    count: number,
    startMonthsBack: number = 6
  ) {
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (startMonthsBack - i));
      await prisma.residentLedger.create({
        data: {
          propertyId,
          residentId,
          transactionType: 'payment',
          chargeCode: 'rent',
          amount: monthlyAmount,
          transactionDate: date,
        },
      });
    }
  }

  async function addCharge(
    propertyId: string,
    residentId: string,
    amount: number,
    monthsAgo: number
  ) {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    await prisma.residentLedger.create({
      data: {
        propertyId,
        residentId,
        transactionType: 'charge',
        chargeCode: 'rent',
        amount,
        transactionDate: date,
      },
    });
  }

  type CreatedResident = Awaited<ReturnType<typeof prisma.resident.create>>;

  interface ResidentScenario {
    firstName: string;
    lastName: string;
    email: string;
    unitNumber: string;
    leaseEndOffset: number; // days from today (positive = future)
    monthlyRent: number;
    leaseType?: string;
    paymentCount: number;
    addDelinquentCharge?: boolean;
    hasRenewalOffer?: boolean;
    renewalStatus?: 'pending' | 'accepted' | 'declined';
  }

  const scenarios: ResidentScenario[] = [
    // HIGH RISK: expires in 25 days, no offer, delinquent, rent below market ($1,400 vs $1,680)
    {
      firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com',
      unitNumber: '101', leaseEndOffset: 25, monthlyRent: 1400,
      paymentCount: 5, addDelinquentCharge: true,
    },
    // HIGH RISK: expires in 28 days, no offer, rent below market
    {
      firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.rivera@example.com',
      unitNumber: '102', leaseEndOffset: 28, monthlyRent: 1400,
      paymentCount: 6,
    },
    // HIGH RISK: expires in 20 days, no offer, delinquent
    {
      firstName: 'Maria', lastName: 'Gonzalez', email: 'maria.g@example.com',
      unitNumber: '103', leaseEndOffset: 20, monthlyRent: 1500,
      paymentCount: 4, addDelinquentCharge: true,
    },
    // HIGH RISK: MTM — lease already nearly expired
    {
      firstName: 'Bob', lastName: 'Williams', email: 'bob.w@example.com',
      unitNumber: '104', leaseEndOffset: 15, monthlyRent: 1450,
      leaseType: 'month_to_month', paymentCount: 6,
    },
    // MEDIUM RISK: expires in 55 days, missed payment, no offer
    {
      firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com',
      unitNumber: '105', leaseEndOffset: 55, monthlyRent: 1500,
      paymentCount: 5, addDelinquentCharge: true,
    },
    // MEDIUM RISK: expires in 60 days, no offer, rent below market
    {
      firstName: 'Diana', lastName: 'Chen', email: 'diana.c@example.com',
      unitNumber: '106', leaseEndOffset: 60, monthlyRent: 1400,
      paymentCount: 6,
    },
    // MEDIUM RISK: expires in 45 days, has offer but delinquent
    {
      firstName: 'Marcus', lastName: 'Johnson', email: 'm.johnson@example.com',
      unitNumber: '107', leaseEndOffset: 45, monthlyRent: 1550,
      paymentCount: 4, addDelinquentCharge: true, hasRenewalOffer: true,
      renewalStatus: 'pending',
    },
    // MEDIUM RISK: expires in 70 days, no offer
    {
      firstName: 'Priya', lastName: 'Patel', email: 'priya.p@example.com',
      unitNumber: '108', leaseEndOffset: 70, monthlyRent: 1600,
      paymentCount: 6,
    },
    // LOW RISK: expires in 180 days, has accepted renewal offer
    {
      firstName: 'Alice', lastName: 'Johnson', email: 'alice.j@example.com',
      unitNumber: '109', leaseEndOffset: 180, monthlyRent: 1600,
      paymentCount: 6, hasRenewalOffer: true, renewalStatus: 'accepted',
    },
    // LOW RISK: expires in 200 days, pending offer, all payments on time
    {
      firstName: 'Thomas', lastName: 'Lee', email: 't.lee@example.com',
      unitNumber: '110', leaseEndOffset: 200, monthlyRent: 1600,
      paymentCount: 6, hasRenewalOffer: true, renewalStatus: 'pending',
    },
    // LOW RISK: 9 months left, all good
    {
      firstName: 'Sarah', lastName: 'Kim', email: 's.kim@example.com',
      unitNumber: '111', leaseEndOffset: 270, monthlyRent: 1600,
      paymentCount: 6,
    },
    // LOW RISK
    {
      firstName: 'Ryan', lastName: 'Nguyen', email: 'r.nguyen@example.com',
      unitNumber: '112', leaseEndOffset: 240, monthlyRent: 1600,
      paymentCount: 6, hasRenewalOffer: true, renewalStatus: 'accepted',
    },
  ];

  const createdResidents: CreatedResident[] = [];

  for (const scenario of scenarios) {
    const unit = units.find((u) => u.unitNumber === scenario.unitNumber);
    if (!unit) throw new Error(`Unit ${scenario.unitNumber} not found`);

    // Resident
    const resident = await prisma.resident.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        firstName: scenario.firstName,
        lastName: scenario.lastName,
        email: scenario.email,
        status: 'active',
      },
    });

    // Lease
    const lease = await prisma.lease.create({
      data: {
        propertyId: property.id,
        residentId: resident.id,
        unitId: unit.id,
        leaseStartDate: daysAgo(365),
        leaseEndDate: daysFromNow(scenario.leaseEndOffset),
        monthlyRent: scenario.monthlyRent,
        leaseType: scenario.leaseType ?? 'fixed',
        status: 'active',
      },
    });

    // Payments
    await addPayments(property.id, resident.id, scenario.monthlyRent, scenario.paymentCount);

    // Delinquency: add a charge that exceeds payments to create net positive balance
    if (scenario.addDelinquentCharge) {
      await addCharge(property.id, resident.id, scenario.monthlyRent, 1);
      // Only add 1 payment for that month (so net = +rent)
    }

    // Renewal offer
    if (scenario.hasRenewalOffer) {
      await prisma.renewalOffer.create({
        data: {
          propertyId: property.id,
          residentId: resident.id,
          leaseId: lease.id,
          renewalStartDate: daysFromNow(scenario.leaseEndOffset),
          renewalEndDate: daysFromNow(scenario.leaseEndOffset + 365),
          proposedRent: scenario.monthlyRent * 1.03,
          status: scenario.renewalStatus ?? 'pending',
        },
      });
    }

    createdResidents.push(resident);
  }

  console.log(`  ✓ ${createdResidents.length} residents with leases and ledger entries`);
  console.log(`
╔══════════════════════════════════════════╗
║  Seed complete!                          ║
║                                          ║
║  Property ID: ${property.id.slice(0, 8)}...            ║
║  Copy the full property ID above to      ║
║  use in API calls and the dashboard.     ║
╚══════════════════════════════════════════╝

  Full Property ID: ${property.id}
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
