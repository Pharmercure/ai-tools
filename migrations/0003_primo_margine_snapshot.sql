-- Snapshot del primo margine: una riga per ogni rigenerazione (ok, scartata dai controlli o fallita).
CREATE TABLE primo_margine_snapshot (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	status TEXT NOT NULL CHECK (status IN ('ok', 'rejected', 'failed')),
	-- esito dei controlli o errore, in JSON
	log TEXT NOT NULL,
	-- dati della dashboard (formato Dati); vuoto se l'aggiornamento è fallito
	data TEXT
);
