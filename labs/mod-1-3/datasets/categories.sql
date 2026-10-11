-- Dataset "categories" for the SQL labs and the in-app SQL Sandbox.
CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, parent_id INTEGER REFERENCES categories(id));
INSERT INTO categories VALUES
  (1,'Coffee',NULL),(2,'Beans',1),(3,'Gear',1),(4,'Single Origin',2),(5,'Blends',2),
  (6,'Grinders',3),(7,'Brewers',3),(8,'Gayo',4),(9,'Toraja',4),
  (10,'Hand Grinders',6),(11,'Electric Grinders',6),(12,'V60',7);
