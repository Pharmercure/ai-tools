CREATE TABLE demo_vendite_ordini (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	data TEXT NOT NULL,
	categoria TEXT NOT NULL,
	importo REAL NOT NULL
);

INSERT INTO demo_vendite_ordini (data, categoria, importo) VALUES
	('2026-09-01', 'Farmaci', 120.50),
	('2026-09-02', 'Parafarmaco', 45.00),
	('2026-09-03', 'Farmaci', 310.20),
	('2026-09-04', 'Cosmetica', 89.90),
	('2026-09-05', 'Parafarmaco', 67.30),
	('2026-09-06', 'Farmaci', 205.00),
	('2026-09-07', 'Cosmetica', 140.00),
	('2026-09-08', 'Farmaci', 98.40);
