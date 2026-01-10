-- Delete simulated users from production database
-- Run this on the production database to remove existing simulated users
-- so they can be recreated with new passwords

-- WARNING: This will permanently delete these users and all their data
-- Only run if you need to recreate the simulated users

BEGIN;

-- Delete from production simulated users (adjust domain as needed)
DELETE FROM auth.users
WHERE email LIKE '%@sim-prod.karmyq.com';

-- Verify count before committing
SELECT COUNT(*) as deleted_count
FROM auth.users
WHERE email LIKE '%@sim-prod.karmyq.com';

-- If count looks correct, commit. Otherwise rollback.
-- COMMIT;
-- ROLLBACK;

END;
