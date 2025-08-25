# Supabase Setup Instructions

## Required: Get Your Supabase Anon Key

Your environment is currently configured to use Supabase, but you need to obtain the **SUPABASE_ANON_KEY** from your Supabase dashboard.

### Steps to Get the Anon Key:

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/projects
   - Select your project: `vjcfmtghnxywvliefvfu`

2. **Access API Settings**
   - In the left sidebar, click on **Settings**
   - Then click on **API**

3. **Copy the Anon Key**
   - In the API settings page, you'll see several keys
   - Copy the **anon** key (also called "anon/public key")
   - This key is safe to use in client-side code

4. **Update Your .env File**
   - Open `/Users/nathan/Desktop/fleet-fraud-dashboard/.env`
   - Find the line: `# SUPABASE_ANON_KEY=[REQUIRED - Get from Supabase dashboard]`
   - Replace it with: `SUPABASE_ANON_KEY=your_actual_anon_key_here`
   - Remove the `#` to uncomment the line

### Example:
```bash
# Before:
# SUPABASE_ANON_KEY=[REQUIRED - Get from Supabase dashboard]

# After:
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Current Configuration Status

✅ **SUPABASE_URL**: Configured  
❌ **SUPABASE_ANON_KEY**: Missing - needs to be obtained  
✅ **DATABASE_URL**: Configured  
✅ **JWT_SECRET**: Configured  

## What Each Key Does:

- **SUPABASE_URL**: Your project's API endpoint
- **SUPABASE_ANON_KEY**: Public key for client-side authentication and queries
- **DATABASE_URL**: Direct PostgreSQL connection string for server-side operations
- **JWT_SECRET**: Used for signing authentication tokens

## Security Notes:

- The **anon key** is safe to expose in client-side code
- The **service role key** should NEVER be exposed to clients
- Keep your `.env` file in `.gitignore` (already configured)
- Use `.env.example` as a template for team members

## Troubleshooting:

If you can't find the anon key:
1. Make sure you're logged into the correct Supabase account
2. Verify you have access to the project `vjcfmtghnxywvliefvfu`
3. Contact your project administrator if you don't have access

Once you've added the anon key, restart your development server to apply the changes.