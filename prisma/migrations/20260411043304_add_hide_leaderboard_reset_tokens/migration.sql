-- Migrate placeholder emails to the canonical @placeholder.com domain
UPDATE "User" SET email = REPLACE(email, '@arguablydebate.com', '@placeholder.com')
WHERE email LIKE '%@arguablydebate.com';

UPDATE "User" SET email = REPLACE(email, '@placeholder.revisare.app', '@placeholder.com')
WHERE email LIKE '%@placeholder.revisare.app';