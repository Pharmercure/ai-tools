-- Verifica fatture fornitori (dashboard supplier-invoices).

-- Fotografie caricate dalla routine di verifica: una per mese di consegne ("month") e una per i
-- tagliandi UBM ("ubm"). Si tiene lo storico; la pagina legge la più recente per tipo e mese.
CREATE TABLE supplier_invoices_snapshots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	kind TEXT NOT NULL CHECK (kind IN ('month', 'ubm')),
	-- AAAA-MM per kind = 'month', vuoto per 'ubm'
	month TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	created_by TEXT NOT NULL,
	-- JSON nel formato descritto in src/apps/supplier-invoices/api/types.ts
	data TEXT NOT NULL
);
CREATE INDEX supplier_invoices_snapshots_kind_month ON supplier_invoices_snapshots (kind, month, id);

-- Coda di verifica: uno scostamento per riga. La routine crea le righe; verdetto, chi e nota li
-- cambiano solo le persone dalla pagina, e un nuovo caricamento non li sovrascrive.
CREATE TABLE supplier_invoices_queue (
	id TEXT PRIMARY KEY,
	month TEXT NOT NULL,
	supplier TEXT NOT NULL,
	invoice TEXT NOT NULL DEFAULT '',
	owner TEXT NOT NULL CHECK (owner IN ('CS', 'Logistica')),
	deliveries TEXT NOT NULL DEFAULT '',
	-- positivo: il fornitore chiede più di quanto calcolato da noi; null se non quantificabile
	amount REAL,
	check_text TEXT NOT NULL DEFAULT '',
	verdict TEXT NOT NULL DEFAULT 'da_verificare'
		CHECK (verdict IN ('da_verificare', 'non_verificabile', 'ragione_nostra', 'ragione_loro', 'ignorato')),
	note TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX supplier_invoices_queue_month ON supplier_invoices_queue (month, supplier);

-- Storico delle modifiche fatte dalle persone (verdetto, chi, nota).
CREATE TABLE supplier_invoices_queue_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	item_id TEXT NOT NULL,
	field TEXT NOT NULL,
	old_value TEXT,
	new_value TEXT,
	changed_by TEXT NOT NULL,
	changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX supplier_invoices_queue_log_item ON supplier_invoices_queue_log (item_id, id);
