# Backend Agent Emergency Tasks

## 🚨 CRITICAL P0 - CASCADING SYSTEM FAILURES
**Date**: 2025-08-22 08:10 UTC  
**Status**: CRITICAL SYSTEM INSTABILITY - EXPANDING ERRORS

### IMMEDIATE ACTIONS REQUIRED (NEXT 5 MINUTES)

#### 1. 🔥 FIX SYNTAX ERRORS BLOCKING SERVER START
**routes/sse.js:112** - Missing catch/finally after try block
**EADDRINUSE**: Multiple server instances attempting to bind ports 3001/3002

#### 2. 🔥 FIX EXPANDING DATABASE ADAPTER ERRORS
**routes/vehicles.js:45** - PERSISTENT: "Cannot read properties of null (reading 'from')"
**routes/drivers.js:43** - PERSISTENT: Same Supabase null error
**routes/fraud.js:497** - NEW: "getDatabase is not defined"
**routes/fraud.js:551** - RESOLVED: "alerts is not defined" - variable declaration added

#### 3. 🔥 FIX DATABASE QUERY SYNTAX ERRORS  
**SQLite Errors**: Malformed query syntax in fraud_alerts
- Error: "select 10 as `limit`, 0 as `offset`..." - invalid SQL syntax
- Database adapter generating incorrect queries

#### 4. 🔥 RESOLVE PORT CONFLICTS AND RESTART ISSUES
**Multiple Server Instances**: Kill conflicting processes
**Continuous Crashes**: Prevent restart loops

### EXPANDING ERROR SCOPE
**47+ errors logged** through 16:14:35 - System degrading rapidly
- Supabase null errors continuing in vehicles/drivers routes
- Database adapter syntax failures in fraud_alerts queries
- New undefined variable/function errors appearing

### AUTHORIZATION GRANTED
- **EMERGENCY AUTHORITY**: Fix ANY files immediately
- **FULL DATABASE ACCESS**: Modify adapter, queries, routes
- **PROCESS CONTROL**: Kill/restart servers as needed

### SUCCESS CRITERIA
- ✅ Server starts and stays running
- ✅ All route errors resolved (vehicles, drivers, fraud)  
- ✅ Database queries execute properly
- ✅ Single stable server instance

### NEW TASK ASSIGNMENT FROM PRODUCT LEAD AGENT
**Date**: 2025-08-22 08:36 UTC
**Priority**: P0 CRITICAL

#### IMMEDIATE TASKS TO EXECUTE:

#### Task 1: Complete Route Error Fixes (5 minutes)
- Fix remaining Supabase null errors in routes/drivers.js:43 and routes/vehicles.js:45
- Replace all supabase.from() calls with database adapter
- Test routes to ensure 200 responses instead of 500 errors

#### Task 2: Resolve Test Failures (5 minutes)  
- Fix api test failures (from HANDOFFS.md line 408)
- Fix integration test failures (from HANDOFFS.md line 437)
- Fix fraudDetection test failures (from HANDOFFS.md line 452)
- Run: `npm test` to verify all tests pass

#### Task 3: System Health Stabilization (5 minutes)
- Ensure server runs without crashes or restart loops
- Verify all 7 fraud detection algorithms operational
- Confirm SSE alerts system functional

#### Task 4: Enterprise Preparation Tasks (10 minutes)
- Begin performance optimization for fraud detection algorithms
- Implement comprehensive error handling and logging improvements
- Add API rate limiting per company (as noted in MEDIUM PRIORITY tasks)
- Prepare webhook system for real-time fraud notifications

**DEADLINE**: 25 minutes total
**REPORTING**: Update status every 10 minutes

**Backend Agent - execute these specific tasks immediately. QA Agent monitoring system health.**