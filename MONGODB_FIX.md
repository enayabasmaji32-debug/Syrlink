# MongoDB Connection Issues - Fix Guide

## Problem
```
pymongo.errors.AutoReconnect: ac-0cpaijn-shard-00-01.uyjzq9y.mongodb.net:27017: connection closed
```

## Root Causes

1. **IP Whitelist issue** - Your IP or Railway's IP is not whitelisted in MongoDB Atlas
2. **Cluster sleeping** - Free tier clusters pause after 30 days of inactivity
3. **Network/Firewall block** - Connection timeout due to network restrictions
4. **Invalid credentials** - Username/password in connection string is incorrect

## Solution Steps

### Step 1: Check MongoDB Atlas IP Whitelist

1. Go to **https://cloud.mongodb.com** and login
2. Navigate to **Network Access** > **IP Whitelist**
3. Check if your IP is whitelisted:
   - For **local development**: Add your IP (you can find it by running `curl ifconfig.me`)
   - For **Railway**: Add `0.0.0.0/0` (temporarily for testing)

### Step 2: Allow Your IP/Railway

- Click **"+ Add IP Address"**
- Choose one:
  - **For local testing**: Add your current IP
  - **For Railway**: Use `0.0.0.0/0` to allow all IPs
  - **Note**: 0.0.0.0/0 is NOT recommended for production!

### Step 3: Check Cluster Status

1. Go to **Clusters** in MongoDB Atlas
2. Ensure cluster shows **"Available"** (not paused)
3. If paused, click **Resume** button
4. Wait for cluster to start (5-10 minutes)

### Step 4: Verify Connection String

Your `.env` should have:
```
MONGO_URL="mongodb+srv://chaincommerceplatform_db_user:HH0VWE95Eqy3myPm@syrlink.uyjzq9y.mongodb.net/syrlink_db"
```

- Replace `chaincommerceplatform_db_user` if needed
- Ensure password matches MongoDB Atlas user password (no special URL encoding issues)

### Step 5: Test Connection

```bash
# Test from command line
mongosh "mongodb+srv://chaincommerceplatform_db_user:YOUR_PASSWORD@syrlink.uyjzq9y.mongodb.net/syrlink_db"
```

### Step 6: For Railway Deployment

1. Go to Railway > Project > Backend
2. Set environment variable `MONGO_URL`:
   ```
   mongodb+srv://chaincommerceplatform_db_user:HH0VWE95Eqy3myPm@syrlink.uyjzq9y.mongodb.net/syrlink_db?retryWrites=true&w=majority
   ```
3. Ensure **IP Whitelist on MongoDB Atlas includes Railway IP ranges**
   - Add `0.0.0.0/0` or specific Railway IP ranges if available
4. Re-deploy application

## MongoDB Atlas IP Whitelist Recommendations

| Environment | IP Range | Notes |
|---|---|---|
| Local Development | Your IP (e.g., 203.0.113.45) | Find with `curl ifconfig.me` |
| Production/Railway | 0.0.0.0/0 or Railway IPs | Not secure - use IP ranges when possible |
| Database URL with Options | Add `?retryWrites=true&w=majority` | Better consistency |

## Connection String Format

```
mongodb+srv://[username]:[password]@[cluster-name].mongodb.net/[database-name]?retryWrites=true&w=majority
```

## Advanced: Connection Pool Settings (Already Optimized)

Backend is now configured with:
- **maxPoolSize=50** - Max connections
- **minPoolSize=5** - Min connections
- **heartbeatFrequencyMS=10000** - Detect failures faster
- **retryWrites=True** - Auto-retry failed writes
- **serverMonitoringMode=auto** - Smart server monitoring

## Check Logs

After deployment:
```bash
# Local
py server.py  # Look for "✓ SyrLink backend ready!" message

# Railway
Railway > Backend > Logs > Look for initialization messages
```

## Contact Support

If still having issues:
1. Check MongoDB Atlas documentation: https://docs.mongodb.com/manual/
2. Check connection errors in Railway logs
3. Verify firewall/network policies
