CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS cells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    legacy_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    source TEXT,
    passage TEXT,
    species TEXT,
    tissue TEXT,
    genotype TEXT,
    geno_detail TEXT,
    medium TEXT,
    serum TEXT,
    abx TEXT,
    selection_marker TEXT,
    cryoprotectant TEXT,
    notes TEXT,
    culture_notes TEXT,
    qc_results_json TEXT,
    qc_notes TEXT,
    registrant TEXT,
    register_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cell_id INTEGER NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
    dewar TEXT NOT NULL,
    rack TEXT NOT NULL,
    box TEXT NOT NULL,
    position TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_available_slot ON vials(dewar, rack, box, position) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS ix_vials_cell_status ON vials(cell_id, status);

CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    cell_id INTEGER,
    vial_id INTEGER,
    operator_name TEXT,
    operator_id INTEGER,
    admin_user_id INTEGER,
    cell_name TEXT,
    qty INTEGER,
    purpose TEXT,
    notes TEXT,
    location_text TEXT,
    position_text TEXT,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issue_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    issue_type TEXT NOT NULL,
    operator_name TEXT,
    dewar TEXT,
    rack TEXT,
    box TEXT,
    position TEXT,
    observed_label TEXT,
    observed_cell_name TEXT,
    observed_passage TEXT,
    observed_date TEXT,
    observed_notes TEXT,
    admin_notes TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_issue_reports_status_created ON issue_reports(status, created_at);

CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
