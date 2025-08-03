-- Add Foreign Key Constraints to TPC-H Database
-- This script adds all standard TPC-H foreign key relationships

-- Note: DuckDB requires that tables exist and that referenced columns 
-- have valid data before adding foreign key constraints

-- 1. Add foreign key from customer.c_nationkey to nation.n_nationkey
ALTER TABLE customer 
ADD CONSTRAINT fk_customer_nation 
FOREIGN KEY (c_nationkey) REFERENCES nation(n_nationkey);

-- 2. Add foreign key from supplier.s_nationkey to nation.n_nationkey  
ALTER TABLE supplier 
ADD CONSTRAINT fk_supplier_nation 
FOREIGN KEY (s_nationkey) REFERENCES nation(n_nationkey);

-- 3. Add foreign key from nation.n_regionkey to region.r_regionkey
ALTER TABLE nation 
ADD CONSTRAINT fk_nation_region 
FOREIGN KEY (n_regionkey) REFERENCES region(r_regionkey);

-- 4. Add foreign key from orders.o_custkey to customer.c_custkey
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (o_custkey) REFERENCES customer(c_custkey);

-- 5. Add foreign key from lineitem.l_orderkey to orders.o_orderkey
ALTER TABLE lineitem 
ADD CONSTRAINT fk_lineitem_orders 
FOREIGN KEY (l_orderkey) REFERENCES orders(o_orderkey);

-- 6. Add foreign key from lineitem.l_partkey to part.p_partkey
ALTER TABLE lineitem 
ADD CONSTRAINT fk_lineitem_part 
FOREIGN KEY (l_partkey) REFERENCES part(p_partkey);

-- 7. Add foreign key from lineitem.l_suppkey to supplier.s_suppkey
ALTER TABLE lineitem 
ADD CONSTRAINT fk_lineitem_supplier 
FOREIGN KEY (l_suppkey) REFERENCES supplier(s_suppkey);

-- 8. Add foreign key from partsupp.ps_partkey to part.p_partkey
ALTER TABLE partsupp 
ADD CONSTRAINT fk_partsupp_part 
FOREIGN KEY (ps_partkey) REFERENCES part(p_partkey);

-- 9. Add foreign key from partsupp.ps_suppkey to supplier.s_suppkey
ALTER TABLE partsupp 
ADD CONSTRAINT fk_partsupp_supplier 
FOREIGN KEY (ps_suppkey) REFERENCES supplier(s_suppkey);

-- Display the foreign key constraints that were added
SELECT 
    table_name,
    constraint_column_names,
    referenced_table,
    referenced_column_names,
    constraint_name
FROM duckdb_constraints 
WHERE constraint_type = 'FOREIGN KEY'
ORDER BY table_name, constraint_name;