-- Insert "Other" category if it doesn't already exist
INSERT INTO "Category" ("id", "slug", "label", "emoji", "description", "order", "isActive", "createdAt")
SELECT gen_random_uuid(), 'other', 'Other', '💬', 'Debates that don''t fit neatly into another category', 99, true, now()
WHERE NOT EXISTS (SELECT 1 FROM "Category" WHERE slug = 'other');