-- Migrate data from original TPC-H database to new database with foreign keys
-- This script copies all data while maintaining referential integrity

-- Attach the original database
ATTACH 'tpch.db' AS original;

-- Copy data in dependency order to maintain foreign key constraints

-- 1. Copy region data (no dependencies)
INSERT INTO region SELECT * FROM original.region;

-- 2. Copy nation data (after region)
INSERT INTO nation SELECT * FROM original.nation;

-- 3. Copy customer data (after nation)
INSERT INTO customer SELECT * FROM original.customer;

-- 4. Copy supplier data (after nation)  
INSERT INTO supplier SELECT * FROM original.supplier;

-- 5. Copy part data (no dependencies)
INSERT INTO part SELECT * FROM original.part;

-- 6. Copy partsupp data (after part and supplier)
INSERT INTO partsupp SELECT * FROM original.partsupp;

-- 7. Copy orders data (after customer)
INSERT INTO orders SELECT * FROM original.orders;

-- 8. Copy lineitem data (after orders, part, and supplier)
INSERT INTO lineitem SELECT * FROM original.lineitem;

-- Detach original database
DETACH original;

-- Verify data counts match
SELECT 'region' as table_name, COUNT(*) as row_count FROM region
UNION ALL
SELECT 'nation', COUNT(*) FROM nation
UNION ALL  
SELECT 'customer', COUNT(*) FROM customer
UNION ALL
SELECT 'supplier', COUNT(*) FROM supplier
UNION ALL
SELECT 'part', COUNT(*) FROM part
UNION ALL
SELECT 'partsupp', COUNT(*) FROM partsupp
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'lineitem', COUNT(*) FROM lineitem
ORDER BY table_name;