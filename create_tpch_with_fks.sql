-- Create TPC-H Database with Foreign Key Constraints
-- This script creates a new TPC-H database structure with all foreign keys

-- First create tables in dependency order (referenced tables first)

-- 1. Create region table (no dependencies)
CREATE TABLE region (
    r_regionkey INTEGER PRIMARY KEY,
    r_name VARCHAR NOT NULL,
    r_comment VARCHAR
);

-- 2. Create nation table (depends on region)
CREATE TABLE nation (
    n_nationkey INTEGER PRIMARY KEY,
    n_name VARCHAR NOT NULL,
    n_regionkey INTEGER NOT NULL,
    n_comment VARCHAR,
    FOREIGN KEY (n_regionkey) REFERENCES region(r_regionkey)
);

-- 3. Create customer table (depends on nation)
CREATE TABLE customer (
    c_custkey BIGINT PRIMARY KEY,
    c_name VARCHAR NOT NULL,
    c_address VARCHAR,
    c_nationkey INTEGER NOT NULL,
    c_phone VARCHAR,
    c_acctbal DECIMAL(15,2),
    c_mktsegment VARCHAR,
    c_comment VARCHAR,
    FOREIGN KEY (c_nationkey) REFERENCES nation(n_nationkey)
);

-- 4. Create supplier table (depends on nation)
CREATE TABLE supplier (
    s_suppkey BIGINT PRIMARY KEY,
    s_name VARCHAR NOT NULL,
    s_address VARCHAR,
    s_nationkey INTEGER NOT NULL,
    s_phone VARCHAR,
    s_acctbal DECIMAL(15,2),
    s_comment VARCHAR,
    FOREIGN KEY (s_nationkey) REFERENCES nation(n_nationkey)
);

-- 5. Create part table (no dependencies)
CREATE TABLE part (
    p_partkey BIGINT PRIMARY KEY,
    p_name VARCHAR NOT NULL,
    p_mfgr VARCHAR,
    p_brand VARCHAR,
    p_type VARCHAR,
    p_size INTEGER,
    p_container VARCHAR,
    p_retailprice DECIMAL(15,2),
    p_comment VARCHAR
);

-- 6. Create partsupp table (depends on part and supplier)
CREATE TABLE partsupp (
    ps_partkey BIGINT NOT NULL,
    ps_suppkey BIGINT NOT NULL,
    ps_availqty BIGINT,
    ps_supplycost DECIMAL(15,2),
    ps_comment VARCHAR,
    PRIMARY KEY (ps_partkey, ps_suppkey),
    FOREIGN KEY (ps_partkey) REFERENCES part(p_partkey),
    FOREIGN KEY (ps_suppkey) REFERENCES supplier(s_suppkey)
);

-- 7. Create orders table (depends on customer)
CREATE TABLE orders (
    o_orderkey BIGINT PRIMARY KEY,
    o_custkey BIGINT NOT NULL,
    o_orderstatus VARCHAR,
    o_totalprice DECIMAL(15,2),
    o_orderdate DATE,
    o_orderpriority VARCHAR,
    o_clerk VARCHAR,
    o_shippriority INTEGER,
    o_comment VARCHAR,
    FOREIGN KEY (o_custkey) REFERENCES customer(c_custkey)
);

-- 8. Create lineitem table (depends on orders, part, and supplier)
CREATE TABLE lineitem (
    l_orderkey BIGINT NOT NULL,
    l_partkey BIGINT NOT NULL,
    l_suppkey BIGINT NOT NULL,
    l_linenumber BIGINT NOT NULL,
    l_quantity DECIMAL(15,2),
    l_extendedprice DECIMAL(15,2),
    l_discount DECIMAL(15,2),
    l_tax DECIMAL(15,2),
    l_returnflag VARCHAR,
    l_linestatus VARCHAR,
    l_shipdate DATE,
    l_commitdate DATE,
    l_receiptdate DATE,
    l_shipinstruct VARCHAR,
    l_shipmode VARCHAR,
    l_comment VARCHAR,
    PRIMARY KEY (l_orderkey, l_linenumber),
    FOREIGN KEY (l_orderkey) REFERENCES orders(o_orderkey),
    FOREIGN KEY (l_partkey) REFERENCES part(p_partkey),
    FOREIGN KEY (l_suppkey) REFERENCES supplier(s_suppkey)
);

-- Display the foreign key constraints that were created
SELECT 
    table_name,
    constraint_column_names,
    referenced_table,
    referenced_column_names,
    constraint_name
FROM duckdb_constraints 
WHERE constraint_type = 'FOREIGN KEY'
ORDER BY table_name, constraint_name;