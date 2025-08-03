-- Create test database with foreign key relationships
-- Drop tables if they exist to allow re-creation
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    city VARCHAR(50)
);

CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(50),
    description TEXT
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name VARCHAR(100),
    category_id INTEGER,
    price DECIMAL(10,2),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    order_date DATE,
    total_amount DECIMAL(10,2),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE order_items (
    order_item_id INTEGER PRIMARY KEY,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Insert sample data
INSERT INTO customers VALUES 
(1, 'John', 'Doe', 'john.doe@email.com', 'New York'),
(2, 'Jane', 'Smith', 'jane.smith@email.com', 'Los Angeles'),
(3, 'Bob', 'Johnson', 'bob.johnson@email.com', 'Chicago'),
(4, 'Alice', 'Williams', 'alice.williams@email.com', 'Houston'),
(5, 'Charlie', 'Brown', 'charlie.brown@email.com', 'Phoenix');

INSERT INTO categories VALUES
(1, 'Electronics', 'Electronic devices and gadgets'),
(2, 'Books', 'Physical and digital books'),
(3, 'Clothing', 'Apparel and accessories'),
(4, 'Home & Garden', 'Home improvement and garden supplies');

INSERT INTO products VALUES
(1, 'Laptop Computer', 1, 999.99),
(2, 'Smartphone', 1, 699.99),
(3, 'Programming Book', 2, 49.99),
(4, 'T-Shirt', 3, 19.99),
(5, 'Garden Hose', 4, 29.99),
(6, 'Tablet', 1, 399.99),
(7, 'Fiction Novel', 2, 14.99),
(8, 'Jeans', 3, 59.99);

INSERT INTO orders VALUES
(1, 1, '2024-01-15', 1049.98),
(2, 2, '2024-01-16', 719.98),
(3, 1, '2024-01-17', 49.99),
(4, 3, '2024-01-18', 79.98),
(5, 4, '2024-01-19', 399.99),
(6, 2, '2024-01-20', 44.98),
(7, 5, '2024-01-21', 29.99);

INSERT INTO order_items VALUES
(1, 1, 1, 1, 999.99),
(2, 1, 4, 2, 19.99),
(3, 1, 7, 2, 14.99),
(4, 2, 2, 1, 699.99),
(5, 2, 4, 1, 19.99),
(6, 3, 3, 1, 49.99),
(7, 4, 8, 1, 59.99),
(8, 4, 4, 1, 19.99),
(9, 5, 6, 1, 399.99),
(10, 6, 3, 1, 49.99),
(11, 6, 7, 3, 14.99),
(12, 7, 5, 1, 29.99);