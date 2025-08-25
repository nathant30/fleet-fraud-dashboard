const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

describe('Database Connection and Integrity Tests', () => {
  let db;
  const testDbPath = path.join(__dirname, '../database/fleet_fraud.db');

  beforeAll((done) => {
    // Check if database file exists
    if (!fs.existsSync(testDbPath)) {
      throw new Error(`Database file not found at ${testDbPath}`);
    }

    db = new sqlite3.Database(testDbPath, (err) => {
      if (err) {
        throw new Error(`Failed to connect to database: ${err.message}`);
      }
      done();
    });
  });

  afterAll((done) => {
    if (db) {
      db.close(done);
    } else {
      done();
    }
  });

  describe('Database Schema Validation', () => {
    it('should have all required tables', (done) => {
      const requiredTables = [
        'users', 'companies', 'vehicles', 'drivers',
        'insurance_policies', 'insurance_claims', 
        'maintenance_records', 'violations', 
        'fraud_alerts', 'audit_logs'
      ];

      db.all(
        "SELECT name FROM sqlite_master WHERE type='table'",
        (err, tables) => {
          if (err) {
            done(err);
            return;
          }

          const tableNames = tables.map(table => table.name);
          
          requiredTables.forEach(tableName => {
            expect(tableNames).toContain(tableName);
          });

          done();
        }
      );
    });

    it('should have proper primary keys', (done) => {
      const tablesToCheck = ['users', 'companies', 'vehicles', 'drivers'];
      let checkedTables = 0;

      tablesToCheck.forEach(tableName => {
        db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
          if (err) {
            done(err);
            return;
          }

          const primaryKeys = columns.filter(col => col.pk === 1);
          expect(primaryKeys.length).toBeGreaterThan(0);
          expect(primaryKeys[0].name).toBe('id');

          checkedTables++;
          if (checkedTables === tablesToCheck.length) {
            done();
          }
        });
      });
    });

    it('should have proper foreign key relationships', (done) => {
      // Check that drivers table references companies
      db.all("PRAGMA foreign_key_list(drivers)", (err, fkeys) => {
        if (err) {
          done(err);
          return;
        }

        const companyReference = fkeys.find(fk => fk.table === 'companies');
        expect(companyReference).toBeDefined();
        expect(companyReference.from).toBe('company_id');

        done();
      });
    });
  });

  describe('Data Integrity Tests', () => {
    it('should have sample data in users table', (done) => {
      db.get("SELECT COUNT(*) as count FROM users", (err, result) => {
        if (err) {
          done(err);
          return;
        }

        expect(result.count).toBeGreaterThan(0);
        done();
      });
    });

    it('should have sample companies', (done) => {
      db.all("SELECT * FROM companies LIMIT 5", (err, companies) => {
        if (err) {
          done(err);
          return;
        }

        expect(Array.isArray(companies)).toBe(true);
        expect(companies.length).toBeGreaterThan(0);

        companies.forEach(company => {
          expect(company).toHaveProperty('id');
          expect(company).toHaveProperty('name');
          expect(company).toHaveProperty('contact_email');
        });

        done();
      });
    });

    it('should have consistent driver-company relationships', (done) => {
      const query = `
        SELECT d.id, (d.first_name || ' ' || d.last_name) as driver_name, c.name as company_name
        FROM drivers d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE c.id IS NULL
        LIMIT 1
      `;

      db.get(query, (err, orphanedDriver) => {
        if (err) {
          done(err);
          return;
        }

        // Should not have orphaned drivers
        expect(orphanedDriver).toBeUndefined();
        done();
      });
    });

    it('should have valid vehicle assignments', (done) => {
      const query = `
        SELECT v.id, v.vin, c.name as company_name
        FROM vehicles v
        LEFT JOIN companies c ON v.company_id = c.id
        WHERE c.id IS NULL
        LIMIT 1
      `;

      db.get(query, (err, orphanedVehicle) => {
        if (err) {
          done(err);
          return;
        }

        expect(orphanedVehicle).toBeUndefined();
        done();
      });
    });
  });

  describe('Fraud Detection Data Validation', () => {
    it('should have fraud alerts with proper structure', (done) => {
      db.all("SELECT * FROM fraud_alerts LIMIT 5", (err, alerts) => {
        if (err) {
          done(err);
          return;
        }

        if (alerts.length > 0) {
          alerts.forEach(alert => {
            expect(alert).toHaveProperty('id');
            expect(alert).toHaveProperty('entity_id');
            expect(alert).toHaveProperty('alert_type');
            expect(alert).toHaveProperty('severity');
            expect(alert).toHaveProperty('status');
            expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
            expect(['open', 'investigating', 'resolved', 'false_positive']).toContain(alert.status);
          });
        }

        done();
      });
    });

    it('should have valid insurance claims data', (done) => {
      db.all("SELECT * FROM insurance_claims LIMIT 5", (err, claims) => {
        if (err) {
          done(err);
          return;
        }

        if (claims.length > 0) {
          claims.forEach(claim => {
            expect(claim).toHaveProperty('id');
            expect(claim).toHaveProperty('policy_id');
            expect(claim).toHaveProperty('claim_amount');
            expect(claim).toHaveProperty('status');
            expect(typeof claim.claim_amount).toBe('number');
          });
        }

        done();
      });
    });

    it('should have audit logs for tracking changes', (done) => {
      db.get("SELECT COUNT(*) as count FROM audit_logs", (err, result) => {
        if (err) {
          done(err);
          return;
        }

        // Audit logs should exist (even if empty initially)
        expect(typeof result.count).toBe('number');
        expect(result.count).toBeGreaterThanOrEqual(0);

        done();
      });
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle large queries efficiently', (done) => {
      const startTime = Date.now();
      
      const complexQuery = `
        SELECT 
          (d.first_name || ' ' || d.last_name) as name,
          d.risk_score,
          c.name as company_name,
          COUNT(v.id) as violation_count
        FROM drivers d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN violations v ON d.id = v.driver_id
        GROUP BY d.id, d.first_name, d.last_name, d.risk_score, c.name
        ORDER BY d.risk_score DESC
        LIMIT 100
      `;

      db.all(complexQuery, (err, results) => {
        if (err) {
          done(err);
          return;
        }

        const queryTime = Date.now() - startTime;
        
        // Query should complete in reasonable time (< 1 second)
        expect(queryTime).toBeLessThan(1000);
        expect(Array.isArray(results)).toBe(true);

        done();
      });
    });

    it('should have proper indexes for fraud detection queries', (done) => {
      // Check for indexes on commonly queried columns
      db.all("SELECT name, sql FROM sqlite_master WHERE type='index'", (err, indexes) => {
        if (err) {
          done(err);
          return;
        }

        const indexNames = indexes.map(idx => idx.name);
        
        // Should have indexes on foreign keys and fraud-related columns
        const expectedIndexPatterns = [
          /company_id/i,
          /driver_id/i,
          /risk_score/i,
          /created_at/i
        ];

        let foundIndexes = 0;
        expectedIndexPatterns.forEach(pattern => {
          if (indexNames.some(name => pattern.test(name) || 
              indexes.some(idx => pattern.test(idx.sql)))) {
            foundIndexes++;
          }
        });

        expect(foundIndexes).toBeGreaterThan(0);
        done();
      });
    });
  });
});