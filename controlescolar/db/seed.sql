-- Seed usuarios (password: 123456)
-- Nota: hashes generados con password_hash(PASSWORD_BCRYPT)
INSERT IGNORE INTO usuarios(id,rol_id,nombre,email,telefono,password_hash,activo) VALUES
(1,1,'Admin','admin@demo.com','', '$2y$10$5FipbX3bIioH0u9aN5W3cOeE9wH0mB5oI5asvIYQXx4QqvPpQ7i3S',1),
(2,2,'Vendedor 1','vend1@demo.com','', '$2y$10$5FipbX3bIioH0u9aN5W3cOeE9wH0mB5oI5asvIYQXx4QqvPpQ7i3S',1),
(3,2,'Vendedor 2','vend2@demo.com','', '$2y$10$5FipbX3bIioH0u9aN5W3cOeE9wH0mB5oI5asvIYQXx4QqvPpQ7i3S',1);
