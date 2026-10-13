UPDATE users
SET pin = NULL
WHERE password_hash IS NOT NULL
  AND pin IS NOT NULL;
