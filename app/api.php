<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

define('DB_DIR', __DIR__ . '/db');
define('BACKUP_DIR', __DIR__ . '/backups');
define('DB_PATH', getenv('CELLSTOCK_DB_PATH') ?: DB_DIR . '/cellstock.sqlite');
define('SCHEMA_PATH', __DIR__ . '/db/schema.sql');
define('DEFAULT_ADMIN_USER', getenv('CELLSTOCK_ADMIN_USERNAME') ?: 'admin');
define('DEFAULT_ADMIN_PASS', getenv('CELLSTOCK_ADMIN_PASSWORD') ?: 'LabAdmin2026!');
define('DEFAULT_LAB_NAME', getenv('CELLSTOCK_LAB_NAME') ?: 'FCT lab');
define('DEFAULT_LANG', normalizeLang(getenv('CELLSTOCK_DEFAULT_LANG') ?: ''));

if (isset($_GET['type']) && $_GET['type'] === 'test') {
    jsonOut(diagnostics());
}

try {
    $pdo = db();
    initDb($pdo);
    migrateLegacyJsonIfNeeded($pdo);
} catch (Throwable $e) {
    http_response_code(500);
    jsonOut([
        'error' => 'SQLite 資料庫初始化失敗：' . $e->getMessage(),
        'diagnostics' => diagnostics(false),
    ]);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    $type = $_GET['type'] ?? '';
    if ($action === 'init') {
        jsonOut(snapshot($pdo));
    }
    if ($type === 'log') {
        jsonOut(fetchLogs($pdo));
    }
    if ($type === 'issues') {
        requireAdmin();
        jsonOut(fetchIssueReports($pdo));
    }
    if ($type === 'celldb') {
        jsonOut(fetchCells($pdo));
    }
    http_response_code(400);
    jsonOut(['error' => 'invalid action']);
}

if ($method !== 'POST') {
    http_response_code(405);
    jsonOut(['error' => 'method not allowed']);
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    jsonOut([
        'error' => 'invalid json',
        'content_length' => isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : null,
        'post_max_size' => ini_get('post_max_size'),
        'json_error' => function_exists('json_last_error_msg') ? json_last_error_msg() : json_last_error(),
    ]);
}

$action = $payload['action'] ?? $payload['type'] ?? '';
$data = $payload['data'] ?? [];

try {
    switch ($action) {
        case 'admin_login':
            adminLogin($pdo, $data);
            jsonOut(['ok' => true, 'admin' => true]);

        case 'admin_logout':
            $_SESSION = [];
            session_destroy();
            jsonOut(['ok' => true]);

        case 'change_admin_password':
            requireAdmin();
            changeAdminPassword($pdo, $data);
            jsonOut(['ok' => true]);

        case 'log_event':
            addOperator($pdo, (string)($data['operator'] ?? '未知'));
            insertLog($pdo, $data);
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'register_cell':
            $result = transaction($pdo, function() use ($pdo, $data) { return registerCell($pdo, $data); });
            jsonOut(['ok' => true, 'cell_id' => $result['cell_id'], 'merged' => $result['merged'] ?? false, 'state' => snapshot($pdo)]);

        case 'store_vials':
            requireAdminOrPayload($pdo, $data);
            $result = transaction($pdo, function() use ($pdo, $data) { return storeVials($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'take_vials':
            $result = transaction($pdo, function() use ($pdo, $data) { return takeVials($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'take_vials_batch':
            $result = transaction($pdo, function() use ($pdo, $data) { return takeVialsBatch($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'create_issue_report':
            $result = transaction($pdo, function() use ($pdo, $data) { return createIssueReport($pdo, $data); });
            jsonOut(['ok' => true, 'issue_id' => $result['issue_id'], 'state' => snapshot($pdo)]);

        case 'update_issue_report':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return updateIssueReport($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'list_issue_reports':
            requireAdminOrPayload($pdo, $data);
            jsonOut([
                'ok' => true,
                'issues' => fetchIssueReports($pdo),
                'issue_open_count' => countOpenIssueReports($pdo),
                'admin' => true,
            ]);

        case 'maintenance_add_cell':
            requireAdminOrPayload($pdo, $data);
            $result = transaction($pdo, function() use ($pdo, $data) { return maintenanceAddCell($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'maintenance_update_cell':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return maintenanceUpdateCell($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_batch_update_cells':
            requireAdminOrPayload($pdo, $data);
            $result = transaction($pdo, function() use ($pdo, $data) { return maintenanceBatchUpdateCells($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'maintenance_delete_vial':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return maintenanceDeleteVial($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_delete_vials':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return maintenanceDeleteVials($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_rename_dewar':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return maintenanceRenameDewar($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_rename_rack':
            requireAdminOrPayload($pdo, $data);
            transaction($pdo, function() use ($pdo, $data) { return maintenanceRenameRack($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_batch_rename_racks':
            transaction($pdo, function() use ($pdo, $data) { return maintenanceBatchRenameRacks($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_rename_box':
            transaction($pdo, function() use ($pdo, $data) { return maintenanceRenameBox($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'maintenance_batch_rename_boxes':
            transaction($pdo, function() use ($pdo, $data) { return maintenanceBatchRenameBoxes($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'set_default_lang':
            requireAdminOrPayload($pdo, $data);
            setDefaultLang($pdo, $data);
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        case 'import_cells':
            requireAdminOrPayload($pdo, $data);
            $result = transaction($pdo, function() use ($pdo, $data) { return importCells($pdo, $data); });
            jsonOut(['ok' => true, 'state' => snapshot($pdo), 'result' => $result]);

        case 'celldb':
        case 'log':
            requireAdminOrPayload($pdo, $data);
            legacyReplace($pdo, $action, $data);
            jsonOut(['ok' => true, 'state' => snapshot($pdo)]);

        default:
            http_response_code(400);
            jsonOut(['error' => 'invalid action']);
    }
} catch (Throwable $e) {
    $code = (int)$e->getCode();
    http_response_code($code >= 400 && $code < 600 ? $code : 500);
    jsonOut(['error' => $e->getMessage()]);
}

function db(): PDO {
    if (!is_dir(DB_DIR)) mkdir(DB_DIR, 0775, true);
    if (!is_dir(BACKUP_DIR)) mkdir(BACKUP_DIR, 0775, true);
    $dbParent = dirname(DB_PATH);
    if (!is_dir($dbParent)) mkdir($dbParent, 0775, true);
    $dsns = [
        'sqlite:file:' . DB_PATH . '?mode=rwc&nolock=1',
        'sqlite:' . DB_PATH,
    ];
    $lastError = null;
    foreach ($dsns as $dsn) {
        try {
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA busy_timeout = 5000');
            $pdo->exec('PRAGMA journal_mode = DELETE');
            $pdo->exec('PRAGMA foreign_keys = ON');
            return $pdo;
        } catch (Throwable $e) {
            $lastError = $e;
        }
    }
    throw new RuntimeException($lastError ? $lastError->getMessage() : 'SQLite connection failed');
}

function initDb(PDO $pdo) {
    $schema = file_get_contents(SCHEMA_PATH);
    if ($schema === false) throw new RuntimeException('找不到資料庫 schema：' . SCHEMA_PATH);
    $pdo->exec($schema);
    migrateCellIndependence($pdo);
    $count = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
    if ($count === 0) {
        if (DEFAULT_ADMIN_PASS === '') throw new RuntimeException('CELLSTOCK_ADMIN_PASSWORD 不可為空');
        $stmt = $pdo->prepare('INSERT INTO admin_users(username, password_hash) VALUES(?, ?)');
        $stmt->execute([DEFAULT_ADMIN_USER, password_hash(DEFAULT_ADMIN_PASS, PASSWORD_DEFAULT)]);
    }
}

function migrateCellIndependence(PDO $pdo) {
    $pdo->exec('DROP INDEX IF EXISTS ux_cells_name_passage');
    $pdo->prepare('INSERT OR IGNORE INTO migrations(name) VALUES(?)')->execute(['cell_independent_vials_v1']);
}

function migrateLegacyJsonIfNeeded(PDO $pdo) {
    $done = (int)$pdo->query("SELECT COUNT(*) FROM migrations WHERE name = 'legacy_json_import_v1'")->fetchColumn();
    if ($done > 0) return;
    $cellCount = (int)$pdo->query('SELECT COUNT(*) FROM cells')->fetchColumn();
    if ($cellCount > 0) {
        $pdo->prepare('INSERT OR IGNORE INTO migrations(name) VALUES(?)')->execute(['legacy_json_import_v1']);
        return;
    }
    $cells = readJsonFile(__DIR__ . '/celldb.json');
    $logs = readJsonFile(__DIR__ . '/oplog.json');
    if (!is_array($cells)) $cells = [];
    if (!is_array($logs)) $logs = [];
    transaction($pdo, function() use ($pdo, $cells, $logs) {
        foreach ($cells as $cell) {
            if (is_array($cell)) upsertCellWithLocations($pdo, $cell);
        }
        foreach ($logs as $log) {
            if (is_array($log)) insertLog($pdo, legacyLogToPayload($log));
        }
        $pdo->prepare('INSERT OR IGNORE INTO migrations(name) VALUES(?)')->execute(['legacy_json_import_v1']);
    });
}

function readJsonFile(string $path): array {
    if (!file_exists($path)) return [];
    $json = file_get_contents($path);
    $data = json_decode($json ?: '[]', true);
    return is_array($data) ? $data : [];
}

function transaction(PDO $pdo, callable $fn) {
    $pdo->beginTransaction();
    try {
        $result = $fn();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function fetchOperators(PDO $pdo): array {
    return $pdo->query("SELECT name FROM operators ORDER BY last_seen_at DESC, name COLLATE NOCASE")->fetchAll(PDO::FETCH_COLUMN);
}

function snapshot(PDO $pdo): array {
    $admin = isAdmin();
    return [
        'cells' => fetchCells($pdo),
        'operators' => fetchOperators($pdo),
        'log' => fetchLogs($pdo),
        'issues' => $admin ? fetchIssueReports($pdo) : [],
        'issue_open_count' => countOpenIssueReports($pdo),
        'admin' => $admin,
        'lab_name' => DEFAULT_LAB_NAME,
        'default_lang' => getSetting($pdo, 'default_lang', DEFAULT_LANG),
    ];
}

function normalizeLang($lang): string {
    $lang = strtolower(trim((string)$lang));
    return $lang === 'zh' ? 'zh' : 'en';
}

function getSetting(PDO $pdo, string $key, string $fallback): string {
    $stmt = $pdo->prepare('SELECT value FROM settings WHERE key = ?');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    return ($value === false || $value === null) ? $fallback : (string)$value;
}

function setSetting(PDO $pdo, string $key, string $value): void {
    $stmt = $pdo->prepare(
        'INSERT INTO settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$key, $value]);
}

function setDefaultLang(PDO $pdo, array $data): void {
    $lang = normalizeLang($data['lang'] ?? '');
    setSetting($pdo, 'default_lang', $lang);
}

function fetchCells(PDO $pdo): array {
    $rows = $pdo->query('SELECT * FROM cells ORDER BY name COLLATE NOCASE')->fetchAll();
    $cells = [];
    foreach ($rows as $row) {
        $cell = cellRowToArray($row);
        $cell['locations'] = fetchCellLocations($pdo, (int)$row['id']);
        $cell['stock'] = array_sum(array_map(function($loc) { return (int)$loc['quantity']; }, $cell['locations']));
        $cells[] = $cell;
    }
    return $cells;
}

function fetchCellLocations(PDO $pdo, int $cellId): array {
    $stmt = $pdo->prepare("
        SELECT dewar, rack, box, GROUP_CONCAT(position, ',') AS positions, COUNT(*) AS quantity
        FROM vials
        WHERE cell_id = ? AND status = 'available'
        GROUP BY dewar, rack, box
        ORDER BY dewar, rack, box
    ");
    $stmt->execute([$cellId]);
    $locations = [];
    foreach ($stmt->fetchAll() as $row) {
        $positions = array_values(array_filter(explode(',', (string)$row['positions'])));
        usort($positions, 'positionCompare');
        $locations[] = [
            'dewar' => $row['dewar'],
            'rack' => $row['rack'],
            'box' => $row['box'],
            'occupied' => $positions,
            'quantity' => count($positions),
        ];
    }
    return $locations;
}

function positionCompare(string $a, string $b): int {
    preg_match('/^([A-Z]+)(\d+)$/i', $a, $ma);
    preg_match('/^([A-Z]+)(\d+)$/i', $b, $mb);
    if ($ma && $mb && strtoupper($ma[1]) === strtoupper($mb[1])) return ((int)$ma[2]) <=> ((int)$mb[2]);
    return strnatcasecmp($a, $b);
}

function fetchLogs(PDO $pdo): array {
    $rows = $pdo->query('SELECT * FROM operation_logs ORDER BY datetime(created_at) DESC, id DESC LIMIT 1000')->fetchAll();
    return array_map(function($row) {
        return [
            'type' => mapEventToUiType($row['event_type']),
            'cell' => $row['cell_name'] ?: '—',
            'qty' => $row['qty'] === null ? null : (int)$row['qty'],
            'operator' => $row['operator_name'] ?: '未知',
            'purpose' => $row['purpose'] ?: '',
            'notes' => $row['notes'] ?: '',
            'locationStr' => $row['location_text'] ?: '',
            'positions' => $row['position_text'] ?: '',
            'time' => $row['created_at'],
        ];
    }, $rows);
}

function mapEventToUiType(string $event): string {
    switch ($event) {
        case 'take_vials':
            return 'take';
        case 'store_vials':
            return 'store';
        case 'register_cell':
            return 'register';
        case 'view_cell':
            return 'view';
        case 'issue_report_created':
        case 'issue_report_updated':
            return 'issue';
        default:
            return strpos($event, 'maintenance') === 0 ? 'maintenance' : $event;
    }
}

function fetchIssueReports(PDO $pdo): array {
    $rows = $pdo->query("
        SELECT *
        FROM issue_reports
        ORDER BY
            CASE status
                WHEN 'open' THEN 0
                WHEN 'reviewing' THEN 1
                WHEN 'resolved' THEN 2
                WHEN 'dismissed' THEN 3
                ELSE 4
            END,
            datetime(created_at) DESC,
            id DESC
        LIMIT 500
    ")->fetchAll();
    return array_map('issueRowToArray', $rows);
}

function countOpenIssueReports(PDO $pdo): int {
    return (int)$pdo->query("SELECT COUNT(*) FROM issue_reports WHERE status IN ('open', 'reviewing')")->fetchColumn();
}

function issueRowToArray(array $row): array {
    return [
        'id' => (int)$row['id'],
        'status' => $row['status'] ?? 'open',
        'priority' => $row['priority'] ?? 'normal',
        'issue_type' => $row['issue_type'] ?? '',
        'operator' => $row['operator_name'] ?? '',
        'dewar' => $row['dewar'] ?? '',
        'rack' => $row['rack'] ?? '',
        'box' => $row['box'] ?? '',
        'position' => $row['position'] ?? '',
        'observed_label' => $row['observed_label'] ?? '',
        'observed_cell_name' => $row['observed_cell_name'] ?? '',
        'observed_passage' => $row['observed_passage'] ?? '',
        'observed_date' => $row['observed_date'] ?? '',
        'observed_notes' => $row['observed_notes'] ?? '',
        'admin_notes' => $row['admin_notes'] ?? '',
        'resolved_by' => $row['resolved_by'] ?? '',
        'resolved_at' => $row['resolved_at'] ?? '',
        'created_at' => $row['created_at'] ?? '',
        'updated_at' => $row['updated_at'] ?? '',
    ];
}

function cellRowToArray(array $row): array {
    return [
        'id' => (int)$row['id'],
        'legacy_id' => $row['legacy_id'] === null ? null : (int)$row['legacy_id'],
        'name' => $row['name'],
        'source' => $row['source'] ?? '',
        'passage' => $row['passage'] ?? '',
        'species' => $row['species'] ?? '',
        'tissue' => $row['tissue'] ?? '',
        'genotype' => $row['genotype'] ?? '',
        'geno_detail' => $row['geno_detail'] ?? '',
        'medium' => $row['medium'] ?? '',
        'serum' => $row['serum'] ?? '',
        'abx' => $row['abx'] ?? '',
        'selection' => $row['selection_marker'] ?? '',
        'cryoprotectant' => $row['cryoprotectant'] ?? '',
        'notes' => $row['notes'] ?? '',
        'culture_notes' => $row['culture_notes'] ?? '',
        'qc_results' => json_decode($row['qc_results_json'] ?: '{}', true) ?: [],
        'qc_notes' => $row['qc_notes'] ?? '',
        'registrant' => $row['registrant'] ?? '',
        'register_date' => $row['register_date'] ?? '',
        'created_at' => $row['created_at'] ?? '',
    ];
}

function cellParams(array $cell): array {
    return [
        ':legacy_id' => isset($cell['id']) && is_numeric($cell['id']) ? (int)$cell['id'] : null,
        ':name' => (string)($cell['name'] ?? '未命名'),
        ':source' => (string)($cell['source'] ?? ''),
        ':passage' => normalizePassage((string)($cell['passage'] ?? '')),
        ':species' => (string)($cell['species'] ?? ''),
        ':tissue' => (string)($cell['tissue'] ?? ''),
        ':genotype' => (string)($cell['genotype'] ?? ''),
        ':geno_detail' => (string)($cell['geno_detail'] ?? ''),
        ':medium' => (string)($cell['medium'] ?? ''),
        ':serum' => (string)($cell['serum'] ?? ''),
        ':abx' => (string)($cell['abx'] ?? ''),
        ':selection_marker' => (string)($cell['selection'] ?? ''),
        ':cryoprotectant' => (string)($cell['cryoprotectant'] ?? ''),
        ':notes' => (string)($cell['notes'] ?? ''),
        ':culture_notes' => (string)($cell['culture_notes'] ?? ''),
        ':qc_results_json' => json_encode($cell['qc_results'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':qc_notes' => (string)($cell['qc_notes'] ?? ''),
        ':registrant' => (string)($cell['registrant'] ?? ''),
        ':register_date' => (string)($cell['register_date'] ?? date('c')),
    ];
}

function insertCell(PDO $pdo, array $cell): int {
    $params = cellParams($cell);
    $stmt = $pdo->prepare("
        INSERT INTO cells(legacy_id, name, source, passage, species, tissue, genotype, geno_detail, medium, serum, abx, selection_marker, cryoprotectant, notes, culture_notes, qc_results_json, qc_notes, registrant, register_date)
        VALUES(:legacy_id, :name, :source, :passage, :species, :tissue, :genotype, :geno_detail, :medium, :serum, :abx, :selection_marker, :cryoprotectant, :notes, :culture_notes, :qc_results_json, :qc_notes, :registrant, :register_date)
    ");
    $stmt->execute($params);
    return (int)$pdo->lastInsertId();
}

function updateCell(PDO $pdo, int $cellId, array $cell) {
    $params = cellParams($cell);
    unset($params[':legacy_id']);
    $params[':id'] = $cellId;
    $stmt = $pdo->prepare("
        UPDATE cells SET
            name=:name, source=:source, passage=:passage, species=:species, tissue=:tissue,
            genotype=:genotype, geno_detail=:geno_detail, medium=:medium, serum=:serum,
            abx=:abx, selection_marker=:selection_marker, cryoprotectant=:cryoprotectant,
            notes=:notes, culture_notes=:culture_notes, qc_results_json=:qc_results_json,
            qc_notes=:qc_notes, registrant=:registrant, register_date=:register_date,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=:id
    ");
    $stmt->execute($params);
}

function upsertCellWithLocations(PDO $pdo, array $cell): int {
    $legacyId = isset($cell['id']) && is_numeric($cell['id']) ? (int)$cell['id'] : null;
    $cellId = null;
    $matchedByLegacy = false;
    if ($legacyId !== null) {
        $stmt = $pdo->prepare('SELECT id FROM cells WHERE legacy_id = ?');
        $stmt->execute([$legacyId]);
        $cellId = $stmt->fetchColumn();
        $matchedByLegacy = (bool)$cellId;
    }
    if (!$cellId) {
        $cellId = findCellByNameAndPassage($pdo, (string)($cell['name'] ?? ''), (string)($cell['passage'] ?? ''));
    }
    if (!$cellId) {
        $cellId = insertCell($pdo, $cell);
    } else {
        $cellId = (int)$cellId;
        $current = fetchCellById($pdo, $cellId);
        updateCell($pdo, $cellId, mergeCellMetadata($current, $cell));
        if ($matchedByLegacy) {
            $pdo->prepare("UPDATE vials SET status='removed', removed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE cell_id=? AND status='available'")->execute([$cellId]);
        }
    }
    foreach (($cell['locations'] ?? []) as $loc) {
        $positions = $loc['occupied'] ?? [];
        foreach ($positions as $pos) {
            try {
                insertAvailableVial($pdo, $cellId, (string)$loc['dewar'], (string)$loc['rack'], (string)$loc['box'], (string)$pos);
            } catch (RuntimeException $e) {
                if ((int)$e->getCode() !== 409) throw $e;
                insertLog($pdo, [
                    'event_type' => 'maintenance_migration_conflict',
                    'cell_id' => $cellId,
                    'cell' => $cell['name'] ?? '未命名',
                    'qty' => 0,
                    'operator' => 'system',
                    'purpose' => '舊 JSON 匯入時略過重複位置',
                    'notes' => $e->getMessage(),
                    'locationStr' => locText($loc),
                    'positions' => (string)$pos,
                    'payload' => $cell,
                ]);
            }
        }
    }
    return $cellId;
}

function insertAvailableVial(PDO $pdo, int $cellId, string $dewar, string $rack, string $box, string $position): int {
    $stmt = $pdo->prepare("SELECT cell_id FROM vials WHERE dewar=? AND rack=? AND box=? AND position=? AND status='available'");
    $stmt->execute([$dewar, $rack, $box, $position]);
    $existing = $stmt->fetch();
    if ($existing) throw new RuntimeException("位置已被佔用：$dewar/$rack/$box/$position", 409);
    $stmt = $pdo->prepare("INSERT INTO vials(cell_id, dewar, rack, box, position) VALUES(?, ?, ?, ?, ?)");
    $stmt->execute([$cellId, $dewar, $rack, $box, $position]);
    return (int)$pdo->lastInsertId();
}

function fetchAvailableVial(PDO $pdo, int $cellId, string $dewar, string $rack, string $box, string $position): array {
    $stmt = $pdo->prepare("SELECT * FROM vials WHERE cell_id=? AND dewar=? AND rack=? AND box=? AND position=? AND status='available'");
    $stmt->execute([$cellId, $dewar, $rack, $box, $position]);
    $vial = $stmt->fetch();
    if (!$vial) throw new RuntimeException("找不到可編輯的凍管：$dewar/$rack/$box/$position", 404);
    return $vial;
}

function countAvailableVialsForCell(PDO $pdo, int $cellId): int {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM vials WHERE cell_id=? AND status='available'");
    $stmt->execute([$cellId]);
    return (int)$stmt->fetchColumn();
}

function registerCell(PDO $pdo, array $data): array {
    $cell = $data['cell'] ?? $data;
    if (!is_array($cell)) throw new RuntimeException('missing cell data', 400);
    $cellId = findCellByNameAndPassage($pdo, (string)($cell['name'] ?? ''), (string)($cell['passage'] ?? ''));
    $merged = false;
    if ($cellId) {
        $merged = true;
        $current = fetchCellById($pdo, $cellId);
        updateCell($pdo, $cellId, mergeCellMetadata($current, $cell));
    } else {
        $cellId = insertCell($pdo, $cell);
    }
    $locations = $cell['locations'] ?? [];
    foreach ($locations as $loc) {
        foreach (($loc['occupied'] ?? []) as $pos) {
            insertAvailableVial($pdo, $cellId, (string)$loc['dewar'], (string)$loc['rack'], (string)$loc['box'], (string)$pos);
        }
    }
    $operator = (string)($cell['registrant'] ?? $data['operator'] ?? '未知');
    addOperator($pdo, $operator);
    $qty = 0;
    $locationParts = [];
    $positionParts = [];
    foreach ($locations as $loc) {
        $positions = $loc['occupied'] ?? [];
        $qty += count($positions);
        $locationParts[] = locText($loc);
        $positionParts[] = implode(', ', $positions);
    }
    insertLog($pdo, [
        'event_type' => 'register_cell',
        'cell_id' => $cellId,
        'cell' => $cell['name'] ?? '',
        'qty' => $qty,
        'operator' => $operator,
        'purpose' => ($merged ? '合併登錄：' : '首次登錄：') . ($cell['name'] ?? ''),
        'notes' => $merged ? '同名同 Passage，自動整合到既有庫存批次' : '',
        'locationStr' => implode('; ', array_filter($locationParts)),
        'positions' => implode('; ', array_filter($positionParts)),
        'payload' => ['cell' => $cell, 'merged' => $merged],
    ]);
    return ['cell_id' => $cellId, 'merged' => $merged];
}

function findCellByNameAndPassage(PDO $pdo, string $name, string $passage) {
    $name = trim($name);
    $passage = normalizePassage($passage);
    if ($name === '') return null;
    $stmt = $pdo->prepare("SELECT id FROM cells WHERE lower(name)=lower(?) AND COALESCE(passage, '')=? LIMIT 1");
    $stmt->execute([$name, $passage]);
    $id = $stmt->fetchColumn();
    return $id ? (int)$id : null;
}

function normalizePassage(string $passage): string {
    $passage = trim($passage);
    if ($passage === '') return '';
    if (preg_match('/^p?\s*(\d+)$/i', $passage, $m)) return 'P' . (int)$m[1];
    return $passage;
}

function mergeCellMetadata(array $current, array $incoming): array {
    $merged = $current;
    foreach ($incoming as $key => $value) {
        if (in_array($key, ['id', 'legacy_id', 'locations', 'stock'], true)) continue;
        if (is_array($value)) {
            if (empty($merged[$key])) $merged[$key] = $value;
        } else {
            $value = trim((string)$value);
            if (($merged[$key] ?? '') === '' && $value !== '') $merged[$key] = $value;
        }
    }
    return $merged;
}

function applyCellOverrides(array $current, array $overrides): array {
    $merged = $current;
    foreach ($overrides as $key => $value) {
        if (in_array($key, ['id', 'legacy_id', 'locations', 'stock'], true)) continue;
        if (is_array($value)) {
            if (!empty($value)) $merged[$key] = $value;
        } else {
            $value = trim((string)$value);
            if ($value !== '') $merged[$key] = $key === 'passage' ? normalizePassage($value) : $value;
        }
    }
    return $merged;
}

function storeVials(PDO $pdo, array $data): array {
    $sourceCellId = requireCellId($data);
    $sourceCell = fetchCellById($pdo, $sourceCellId);
    $overrides = isset($data['cell']) && is_array($data['cell']) ? normalizeStoreCellOverrides($data['cell']) : [];
    $cellId = $sourceCellId;
    $cell = $sourceCell;
    if ($overrides) {
        $targetPreview = applyCellOverrides($sourceCell, $overrides);
        $matchedCellId = findCellByNameAndPassage($pdo, (string)($targetPreview['name'] ?? ''), (string)($targetPreview['passage'] ?? ''));
        if ($matchedCellId) {
            $cellId = (int)$matchedCellId;
            $currentTarget = fetchCellById($pdo, $cellId);
            $cell = applyCellOverrides($currentTarget, $overrides);
            updateCell($pdo, $cellId, $cell);
        } else {
            $cell = applyCellOverrides($sourceCell, $overrides);
            $cell['registrant'] = (string)($data['operator'] ?? $cell['registrant'] ?? $sourceCell['registrant'] ?? '');
            $cell['register_date'] = (string)($overrides['register_date'] ?? date('c'));
            unset($cell['id'], $cell['legacy_id'], $cell['locations'], $cell['stock']);
            $cellId = insertCell($pdo, $cell);
            $cell = fetchCellById($pdo, $cellId);
        }
    }
    $locations = normalizeLocationsFromPayload($data);
    $qty = 0;
    foreach ($locations as $loc) {
        foreach ($loc['occupied'] as $pos) {
            insertAvailableVial($pdo, $cellId, $loc['dewar'], $loc['rack'], $loc['box'], $pos);
            $qty++;
        }
    }
    $operator = (string)($data['operator'] ?? '未知');
    addOperator($pdo, $operator);
    insertLog($pdo, [
        'event_type' => 'store_vials',
        'cell_id' => $cellId,
        'cell' => $cell['name'],
        'qty' => $qty,
        'operator' => $operator,
        'purpose' => (string)($data['purpose'] ?? ''),
        'notes' => (string)($data['notes'] ?? ''),
        'locationStr' => implode('; ', array_map('locText', $locations)),
        'positions' => implode('; ', array_map(function($loc) { return implode(', ', $loc['occupied']); }, $locations)),
        'payload' => array_merge($data, ['cell' => $cell]),
    ]);
    return ['cell_id' => $cellId, 'locations' => $locations, 'locationStr' => implode('; ', array_map('locText', $locations))];
}

function normalizeLocationsFromPayload(array $data): array {
    if (isset($data['locations']) && is_array($data['locations'])) {
        $locations = [];
        foreach ($data['locations'] as $loc) {
            if (!is_array($loc)) continue;
            $positions = $loc['occupied'] ?? $loc['positions'] ?? [];
            if (is_string($positions)) $positions = array_map('trim', explode(',', $positions));
            $positions = array_values(array_filter(array_map('strval', (array)$positions), function($p) { return trim($p) !== ''; }));
            if (!$positions) continue;
            $locations[] = [
                'dewar' => trim((string)($loc['dewar'] ?? '')),
                'rack' => trim((string)($loc['rack'] ?? '')),
                'box' => trim((string)($loc['box'] ?? '')),
                'occupied' => $positions,
                'quantity' => count($positions),
            ];
        }
        if (!$locations) throw new RuntimeException('missing locations', 400);
        foreach ($locations as $loc) {
            if ($loc['dewar'] === '' || $loc['rack'] === '' || $loc['box'] === '') throw new RuntimeException('missing location fields', 400);
        }
        return $locations;
    }
    return [[
        'dewar' => requireString($data, 'dewar'),
        'rack' => requireString($data, 'rack'),
        'box' => requireString($data, 'box'),
        'occupied' => requirePositions($data),
    ]];
}

function normalizeStoreCellOverrides(array $data): array {
    $fields = [
        'name', 'source', 'passage', 'species', 'tissue', 'genotype', 'geno_detail',
        'medium', 'serum', 'abx', 'selection', 'cryoprotectant', 'notes', 'culture_notes',
        'qc_notes', 'registrant', 'register_date',
    ];
    $cell = [];
    foreach ($fields as $field) {
        if (!array_key_exists($field, $data)) continue;
        $value = trim((string)$data[$field]);
        if ($value === '') continue;
        $cell[$field] = $field === 'passage' ? normalizePassage($value) : $value;
    }
    if (isset($data['qc_results']) && is_array($data['qc_results'])) {
        $cell['qc_results'] = $data['qc_results'];
    }
    return $cell;
}

function takeVials(PDO $pdo, array $data): array {
    $cellId = requireCellId($data);
    $cell = fetchCellById($pdo, $cellId);
    $positions = requirePositions($data);
    $dewar = requireString($data, 'dewar');
    $rack = requireString($data, 'rack');
    $box = requireString($data, 'box');
    foreach ($positions as $pos) {
        $stmt = $pdo->prepare("SELECT id FROM vials WHERE cell_id=? AND dewar=? AND rack=? AND box=? AND position=? AND status='available'");
        $stmt->execute([$cellId, $dewar, $rack, $box, $pos]);
        $vialId = $stmt->fetchColumn();
        if (!$vialId) throw new RuntimeException("此凍管已不存在或已被取出：$dewar/$rack/$box/$pos", 409);
        $pdo->prepare("UPDATE vials SET status='removed', removed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([(int)$vialId]);
    }
    $operator = (string)($data['operator'] ?? '未知');
    addOperator($pdo, $operator);
    insertLog($pdo, [
        'event_type' => 'take_vials',
        'cell_id' => $cellId,
        'cell' => $cell['name'],
        'qty' => count($positions),
        'operator' => $operator,
        'purpose' => (string)($data['purpose'] ?? ''),
        'notes' => (string)($data['notes'] ?? ''),
        'locationStr' => "$dewar/$rack/$box",
        'positions' => implode(', ', $positions),
        'payload' => $data,
    ]);
    return ['positions' => $positions, 'locationStr' => "$dewar/$rack/$box"];
}

function takeVialsBatch(PDO $pdo, array $data): array {
    $items = $data['items'] ?? [];
    if (!is_array($items) || empty($items)) throw new RuntimeException('購物車是空的', 400);
    $operator = (string)($data['operator'] ?? '未知');
    $purpose = (string)($data['purpose'] ?? '');
    $notes = (string)($data['notes'] ?? '');
    $results = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $results[] = takeVials($pdo, $item + ['operator' => $operator, 'purpose' => $purpose, 'notes' => $notes]);
    }
    if (!$results) throw new RuntimeException('購物車是空的', 400);
    return ['items' => $results];
}

function createIssueReport(PDO $pdo, array $data): array {
    $issueType = requireString($data, 'issue_type');
    $operator = trim((string)($data['operator'] ?? $data['operator_name'] ?? '未知')) ?: '未知';
    $dewar = requireString($data, 'dewar');
    $rack = requireString($data, 'rack');
    $box = requireString($data, 'box');
    $positions = normalizeIssuePositions($data);
    $positionText = implode(', ', $positions);
    $priority = normalizeIssuePriority((string)($data['priority'] ?? 'normal'));
    addOperator($pdo, $operator);

    $stmt = $pdo->prepare("
        INSERT INTO issue_reports(
            status, priority, issue_type, operator_name, dewar, rack, box, position,
            observed_label, observed_cell_name, observed_passage, observed_date, observed_notes
        )
        VALUES('open', :priority, :issue_type, :operator_name, :dewar, :rack, :box, :position,
            :observed_label, :observed_cell_name, :observed_passage, :observed_date, :observed_notes)
    ");
    $stmt->execute([
        ':priority' => $priority,
        ':issue_type' => $issueType,
        ':operator_name' => $operator,
        ':dewar' => $dewar,
        ':rack' => $rack,
        ':box' => $box,
        ':position' => $positionText,
        ':observed_label' => trim((string)($data['observed_label'] ?? '')),
        ':observed_cell_name' => trim((string)($data['observed_cell_name'] ?? '')),
        ':observed_passage' => trim((string)($data['observed_passage'] ?? '')),
        ':observed_date' => trim((string)($data['observed_date'] ?? '')),
        ':observed_notes' => trim((string)($data['observed_notes'] ?? '')),
    ]);
    $issueId = (int)$pdo->lastInsertId();
    insertLog($pdo, [
        'event_type' => 'issue_report_created',
        'cell' => '異常回報 #' . $issueId,
        'qty' => null,
        'operator' => $operator,
        'purpose' => issueTypeLabel($issueType),
        'notes' => trim((string)($data['observed_notes'] ?? '')),
        'locationStr' => "$dewar/$rack/$box",
        'positions' => $positionText,
        'payload' => ['issue_id' => $issueId, 'issue' => $data],
    ]);
    return ['issue_id' => $issueId];
}

function normalizeIssuePositions(array $data): array {
    $positions = $data['positions'] ?? $data['position'] ?? [];
    if (is_string($positions)) $positions = array_map('trim', explode(',', $positions));
    if (!is_array($positions)) throw new RuntimeException('missing positions', 400);
    $positions = array_values(array_unique(array_filter(array_map('strval', $positions), function($p) {
        return trim($p) !== '';
    })));
    if (!$positions) throw new RuntimeException('missing positions', 400);
    usort($positions, 'positionCompare');
    return $positions;
}

function updateIssueReport(PDO $pdo, array $data) {
    $issueId = isset($data['issue_id']) && is_numeric($data['issue_id']) ? (int)$data['issue_id'] : 0;
    if ($issueId <= 0) throw new RuntimeException('missing issue_id', 400);
    $stmt = $pdo->prepare('SELECT * FROM issue_reports WHERE id=?');
    $stmt->execute([$issueId]);
    $current = $stmt->fetch();
    if (!$current) throw new RuntimeException('找不到異常回報', 404);

    $status = normalizeIssueStatus((string)($data['status'] ?? $current['status']));
    $adminNotes = trim((string)($data['admin_notes'] ?? $current['admin_notes'] ?? ''));
    $resolvedBy = trim((string)($data['resolved_by'] ?? $_SESSION['admin_username'] ?? 'admin')) ?: 'admin';
    $isClosed = in_array($status, ['resolved', 'dismissed'], true);

    $stmt = $pdo->prepare("
        UPDATE issue_reports
        SET status=:status,
            priority=:priority,
            admin_notes=:admin_notes,
            resolved_by=:resolved_by,
            resolved_at=:resolved_at,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=:id
    ");
    $stmt->execute([
        ':status' => $status,
        ':priority' => normalizeIssuePriority((string)($data['priority'] ?? $current['priority'] ?? 'normal')),
        ':admin_notes' => $adminNotes,
        ':resolved_by' => $isClosed ? $resolvedBy : '',
        ':resolved_at' => $isClosed ? date('c') : null,
        ':id' => $issueId,
    ]);
    insertLog($pdo, [
        'event_type' => 'issue_report_updated',
        'cell' => '異常回報 #' . $issueId,
        'operator' => 'admin',
        'purpose' => '異常回報狀態更新：' . issueStatusLabel($status),
        'notes' => $adminNotes,
        'locationStr' => (string)$current['dewar'] . '/' . (string)$current['rack'] . '/' . (string)$current['box'],
        'positions' => (string)$current['position'],
        'payload' => ['issue_id' => $issueId, 'status' => $status, 'admin_notes' => $adminNotes],
    ]);
}

function normalizeIssueStatus(string $status): string {
    $status = trim($status);
    return in_array($status, ['open', 'reviewing', 'resolved', 'dismissed'], true) ? $status : 'open';
}

function normalizeIssuePriority(string $priority): string {
    $priority = trim($priority);
    return in_array($priority, ['normal', 'high'], true) ? $priority : 'normal';
}

function issueStatusLabel(string $status): string {
    $map = ['open' => '待處理', 'reviewing' => '處理中', 'resolved' => '已完成', 'dismissed' => '不需處理'];
    return $map[$status] ?? $status;
}

function issueTypeLabel(string $type): string {
    $map = [
        'unknown_vial_in_empty_slot' => '空位發現未知凍管',
        'missing_expected_vial' => '應有凍管但找不到',
        'label_unclear' => '標籤不清',
        'data_mismatch' => '資料不一致',
        'damaged_or_contaminated' => '凍管破損或污染疑慮',
        'other' => '其他異常',
    ];
    return $map[$type] ?? $type;
}

function maintenanceAddCell(PDO $pdo, array $data): array {
    $cell = $data['cell'] ?? [];
    $cell['registrant'] = (string)($cell['registrant'] ?? '');
    if ($cell['registrant'] !== '') addOperator($pdo, $cell['registrant']);
    $cell['register_date'] = $cell['register_date'] ?? date('c');
    $cellId = insertCell($pdo, $cell);
    $positions = requirePositions($data);
    $dewar = requireString($data, 'dewar');
    $rack = requireString($data, 'rack');
    $box = requireString($data, 'box');
    foreach ($positions as $pos) insertAvailableVial($pdo, $cellId, $dewar, $rack, $box, $pos);
    insertLog($pdo, [
        'event_type' => 'maintenance_add_cell',
        'cell_id' => $cellId,
        'cell' => $cell['name'] ?? '未命名',
        'qty' => count($positions),
        'operator' => 'admin',
        'purpose' => '維護模式新增',
        'notes' => "新增到 $dewar/$rack/$box/" . implode(', ', $positions),
        'locationStr' => "$dewar/$rack/$box",
        'positions' => implode(', ', $positions),
        'payload' => $data,
    ]);
    return ['cell_id' => $cellId];
}

function maintenanceUpdateCell(PDO $pdo, array $data) {
    $cellId = requireCellId($data);
    $current = fetchCellById($pdo, $cellId);
    $fields = $data['cell'] ?? [];
    if (!is_array($fields)) $fields = [];
    $registrant = trim((string)($fields['registrant'] ?? $current['registrant'] ?? ''));
    if ($registrant !== '') addOperator($pdo, $registrant);
    $targetCellId = $cellId;
    $targetCell = array_merge($current, $fields);
    $positions = requirePositions($data);
    $position = (string)$positions[0];
    $dewar = '';
    $rack = '';
    $box = '';
    $locationStr = trim((string)($data['locationStr'] ?? ''));
    if ($locationStr !== '') {
        $parts = array_map('trim', explode('/', $locationStr));
        if (count($parts) >= 3) {
            $dewar = $parts[0];
            $rack = $parts[1];
            $box = $parts[2];
        }
    }
    if ($dewar === '') $dewar = requireString($data, 'dewar');
    if ($rack === '') $rack = requireString($data, 'rack');
    if ($box === '') $box = requireString($data, 'box');

    $vial = fetchAvailableVial($pdo, $cellId, $dewar, $rack, $box, $position);
    if (countAvailableVialsForCell($pdo, $cellId) > 1) {
        unset($targetCell['id'], $targetCell['legacy_id'], $targetCell['locations'], $targetCell['stock']);
        $targetCellId = insertCell($pdo, $targetCell);
        $stmt = $pdo->prepare("UPDATE vials SET cell_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $stmt->execute([$targetCellId, (int)$vial['id']]);
    } else {
        updateCell($pdo, $cellId, $targetCell);
    }
    insertLog($pdo, [
        'event_type' => 'maintenance_update_cell',
        'cell_id' => $targetCellId,
        'vial_id' => (int)$vial['id'],
        'cell' => $fields['name'] ?? $current['name'],
        'qty' => null,
        'operator' => 'admin',
        'purpose' => '維護模式編輯',
        'locationStr' => "$dewar/$rack/$box",
        'positions' => $position,
        'payload' => $data + ['original_cell_id' => $cellId, 'updated_cell_id' => $targetCellId],
    ]);
}

function maintenanceBatchUpdateCells(PDO $pdo, array $data): array {
    $updates = $data['updates'] ?? [];
    if (!is_array($updates) || !$updates) throw new RuntimeException('missing updates', 400);
    $updated = 0;
    foreach ($updates as $idx => $update) {
        if (!is_array($update)) continue;
        $cellId = requireCellId($update);
        $current = fetchCellById($pdo, $cellId);
        $fields = $update['cell'] ?? [];
        if (!is_array($fields) || !$fields) continue;

        // Build selected position keys from selected_slots
        $selectedSlots = $update['selected_slots'] ?? [];
        if (is_array($selectedSlots) && !empty($selectedSlots)) {
            $selectedKeys = [];
            foreach ($selectedSlots as $s) {
                if (is_array($s)) {
                    $selectedKeys[] = ($s['dewar']??'').'/'.(($s['rack']??'').'/'.($s['box']??'').'/'.($s['pos']??''));
                }
            }
            // Find vials with this cell_id that are NOT among the selected positions
            $stmt = $pdo->prepare('SELECT id, dewar, rack, box, position FROM vials WHERE cell_id=? AND status=\'available\'');
            $stmt->execute([$cellId]);
            $allVials = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $unselectedIds = [];
            foreach ($allVials as $v) {
                $key = $v['dewar'].'/'.$v['rack'].'/'.$v['box'].'/'.$v['position'];
                if (!in_array($key, $selectedKeys, true)) {
                    $unselectedIds[] = (int)$v['id'];
                }
            }
            // Clone cell record so unselected vials keep original data
            if (!empty($unselectedIds)) {
                $cloneData = $current;
                unset($cloneData['id']);
                $newCellId = insertCell($pdo, $cloneData);
                $ph = implode(',', array_fill(0, count($unselectedIds), '?'));
                $stmt = $pdo->prepare("UPDATE vials SET cell_id=?, updated_at=CURRENT_TIMESTAMP WHERE id IN ($ph)");
                $stmt->execute(array_merge([$newCellId], $unselectedIds));
            }
        }

        updateCell($pdo, $cellId, array_merge($current, $fields));
        insertLog($pdo, [
            'event_type' => 'maintenance_batch_update_cell',
            'cell_id' => $cellId,
            'cell' => $fields['name'] ?? $current['name'],
            'qty' => null,
            'operator' => 'admin',
            'purpose' => '維護模式批次修改',
            'locationStr' => (string)($update['locationStr'] ?? ''),
            'positions' => (string)($update['positions'] ?? ''),
            'payload' => $update,
        ]);
        $updated++;
    }
    return ['updated' => $updated];
}

function maintenanceDeleteVial(PDO $pdo, array $data) {
    $cellId = requireCellId($data);
    $cell = fetchCellById($pdo, $cellId);
    $dewar = requireString($data, 'dewar');
    $rack = requireString($data, 'rack');
    $box = requireString($data, 'box');
    $position = requireString($data, 'position');
    $stmt = $pdo->prepare("UPDATE vials SET status='discarded', removed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE cell_id=? AND dewar=? AND rack=? AND box=? AND position=? AND status='available'");
    $stmt->execute([$cellId, $dewar, $rack, $box, $position]);
    if ($stmt->rowCount() === 0) throw new RuntimeException('找不到可刪除的記錄', 404);
    insertLog($pdo, [
        'event_type' => 'maintenance_delete_vial',
        'cell_id' => $cellId,
        'cell' => $cell['name'],
        'qty' => -1,
        'operator' => 'admin',
        'purpose' => (string)($data['purpose'] ?? '維護模式刪除'),
        'notes' => "從 $dewar/$rack/$box/$position 刪除",
        'locationStr' => "$dewar/$rack/$box",
        'positions' => $position,
        'payload' => $data,
    ]);
}

function maintenanceDeleteVials(PDO $pdo, array $data) {
    $records = $data['records'] ?? [];
    if (!is_array($records)) throw new RuntimeException('missing records', 400);
    foreach ($records as $record) {
        if (is_array($record)) maintenanceDeleteVial($pdo, $record + ['purpose' => $data['purpose'] ?? '維護模式批次刪除']);
    }
}

function maintenanceBatchRenameRacks(PDO $pdo, array $data) {
    $dewar   = requireString($data, 'dewar');
    $renames = $data['renames'] ?? [];
    if (!is_array($renames) || empty($renames)) return;
    $stmt = $pdo->prepare("UPDATE vials SET rack=?, updated_at=CURRENT_TIMESTAMP WHERE dewar=? AND rack=?");
    $summary = [];
    foreach ($renames as $pair) {
        $old = (string)($pair['old'] ?? '');
        $new = (string)($pair['new'] ?? '');
        if ($old === '' || $new === '' || $old === $new) continue;
        $stmt->execute([$new, $dewar, $old]);
        $summary[] = "$old→$new";
    }
    if (!empty($summary)) {
        insertLog($pdo, [
            'event_type' => 'maintenance_rename_rack',
            'cell' => '維護模式',
            'operator' => 'admin',
            'purpose' => 'Rack 批次重新命名',
            'notes' => "$dewar / " . implode(', ', $summary),
            'locationStr' => $dewar,
            'positions' => '',
            'payload' => $data,
        ]);
    }
}

function maintenanceRenameBox(PDO $pdo, array $data) {
    $dewar = requireString($data, 'dewar');
    $rack  = requireString($data, 'rack');
    $old   = requireString($data, 'old_box');
    $new   = requireString($data, 'new_box');
    if ($old === $new) return;
    $pdo->prepare("UPDATE vials SET box=?, updated_at=CURRENT_TIMESTAMP WHERE dewar=? AND rack=? AND box=?")->execute([$new, $dewar, $rack, $old]);
    insertLog($pdo, [
        'event_type' => 'maintenance_rename_box',
        'cell' => '維護模式',
        'operator' => 'admin',
        'purpose' => 'Box 重新命名',
        'notes' => "$dewar/$rack / $old 重新命名為 $new",
        'locationStr' => "$dewar/$rack/$new",
        'positions' => '',
        'payload' => $data,
    ]);
}

function maintenanceBatchRenameBoxes(PDO $pdo, array $data) {
    $dewar   = requireString($data, 'dewar');
    $rack    = requireString($data, 'rack');
    $renames = $data['renames'] ?? [];
    if (!is_array($renames) || empty($renames)) return;
    $stmt = $pdo->prepare("UPDATE vials SET box=?, updated_at=CURRENT_TIMESTAMP WHERE dewar=? AND rack=? AND box=?");
    $summary = [];
    foreach ($renames as $pair) {
        $old = (string)($pair['old'] ?? '');
        $new = (string)($pair['new'] ?? '');
        if ($old === '' || $new === '' || $old === $new) continue;
        $stmt->execute([$new, $dewar, $rack, $old]);
        $summary[] = "$old→$new";
    }
    if (!empty($summary)) {
        insertLog($pdo, [
            'event_type' => 'maintenance_rename_box',
            'cell' => '維護模式',
            'operator' => 'admin',
            'purpose' => 'Box 批次重新命名',
            'notes' => "$dewar/$rack / " . implode(', ', $summary),
            'locationStr' => "$dewar/$rack",
            'positions' => '',
            'payload' => $data,
        ]);
    }
}

function maintenanceRenameRack(PDO $pdo, array $data) {
    $dewar = requireString($data, 'dewar');
    $old   = requireString($data, 'old_rack');
    $new   = requireString($data, 'new_rack');
    if ($old === $new) return;
    $stmt = $pdo->prepare("UPDATE vials SET rack=?, updated_at=CURRENT_TIMESTAMP WHERE dewar=? AND rack=?");
    $stmt->execute([$new, $dewar, $old]);
    insertLog($pdo, [
        'event_type' => 'maintenance_rename_rack',
        'cell' => '維護模式',
        'operator' => 'admin',
        'purpose' => 'Rack 重新命名',
        'notes' => "$dewar / $old 重新命名為 $new",
        'locationStr' => "$dewar/$new",
        'positions' => '',
        'payload' => $data,
    ]);
}

function maintenanceRenameDewar(PDO $pdo, array $data) {
    $old = requireString($data, 'old_dewar');
    $new = requireString($data, 'new_dewar');
    if ($old === $new) return;
    $stmt = $pdo->prepare("UPDATE vials SET dewar=?, updated_at=CURRENT_TIMESTAMP WHERE dewar=?");
    $stmt->execute([$new, $old]);
    insertLog($pdo, [
        'event_type' => 'maintenance_rename_dewar',
        'cell' => '維護模式',
        'operator' => 'admin',
        'purpose' => 'Dewar 重新命名',
        'notes' => "$old 重新命名為 $new",
        'locationStr' => $new,
        'positions' => '',
        'payload' => $data,
    ]);
}

function importCells(PDO $pdo, array $data): array {
    $cells = $data['cells'] ?? [];
    if (!is_array($cells)) throw new RuntimeException('missing cells', 400);
    $added = 0;
    $updated = 0;
    $rowNumber = 1;
    foreach ($cells as $cell) {
        $rowNumber++;
        try {
            if (!is_array($cell) || empty($cell['name'])) continue;
            $existing = findCellByNameAndPassage($pdo, (string)$cell['name'], (string)($cell['passage'] ?? ''));
            if ($existing) {
                $cellId = (int)$existing;
                $current = fetchCellById($pdo, $cellId);
                updateCell($pdo, $cellId, array_merge($current, $cell));
                foreach (($cell['locations'] ?? []) as $loc) {
                    foreach (($loc['occupied'] ?? []) as $pos) {
                        try {
                            insertAvailableVial($pdo, $cellId, (string)$loc['dewar'], (string)$loc['rack'], (string)$loc['box'], (string)$pos);
                        } catch (RuntimeException $e) {
                            if ((int)$e->getCode() !== 409) throw $e;
                        }
                    }
                }
                $updated++;
            } else {
                upsertCellWithLocations($pdo, $cell);
                $added++;
            }
        } catch (Throwable $e) {
            $code = (int)$e->getCode();
            throw new RuntimeException('CSV 第 ' . $rowNumber . ' 列匯入失敗（' . (string)($cell['name'] ?? '未命名') . '）：' . $e->getMessage(), $code >= 400 && $code < 600 ? $code : 500);
        }
    }
    insertLog($pdo, [
        'event_type' => 'maintenance_import_cells',
        'cell' => 'CSV 匯入',
        'qty' => $added + $updated,
        'operator' => 'admin',
        'purpose' => "匯入完成：新增 $added 筆，更新 $updated 筆",
        'payload' => ['added' => $added, 'updated' => $updated],
    ]);
    return ['added' => $added, 'updated' => $updated];
}

function legacyReplace(PDO $pdo, string $type, array $data) {
    if ($type === 'celldb') {
        backupSqlite();
        $pdo->exec('DELETE FROM vials; DELETE FROM cells;');
        foreach ($data as $cell) if (is_array($cell)) upsertCellWithLocations($pdo, $cell);
    }
    if ($type === 'log') {
        $pdo->exec('DELETE FROM operation_logs');
        foreach ($data as $log) if (is_array($log)) insertLog($pdo, legacyLogToPayload($log));
    }
}

function backupSqlite() {
    if (!file_exists(DB_PATH)) return;
    $target = BACKUP_DIR . '/cellstock-' . date('Ymd-His') . '.sqlite';
    @copy(DB_PATH, $target);
}

function addOperator(PDO $pdo, string $name) {
    $name = trim($name) ?: '未知';
    $stmt = $pdo->prepare("INSERT INTO operators(name) VALUES(?) ON CONFLICT(name) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP");
    $stmt->execute([$name]);
    $stmt = $pdo->prepare('SELECT id FROM operators WHERE name=?');
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    return $id ? (int)$id : null;
}

function insertLog(PDO $pdo, array $data) {
    $operator = (string)($data['operator'] ?? $data['operator_name'] ?? '未知');
    if ($operator === 'admin') return;
    $event = (string)($data['event_type'] ?? $data['type'] ?? 'event');
    $operatorId = addOperator($pdo, $operator);
    $stmt = $pdo->prepare("
        INSERT INTO operation_logs(event_type, cell_id, vial_id, operator_name, operator_id, admin_user_id, cell_name, qty, purpose, notes, location_text, position_text, payload_json, created_at)
        VALUES(:event_type, :cell_id, :vial_id, :operator_name, :operator_id, :admin_user_id, :cell_name, :qty, :purpose, :notes, :location_text, :position_text, :payload_json, :created_at)
    ");
    $stmt->execute([
        ':event_type' => $event,
        ':cell_id' => isset($data['cell_id']) ? (int)$data['cell_id'] : null,
        ':vial_id' => isset($data['vial_id']) ? (int)$data['vial_id'] : null,
        ':operator_name' => $operator,
        ':operator_id' => $operatorId,
        ':admin_user_id' => isAdmin() ? (int)($_SESSION['admin_user_id'] ?? 0) : null,
        ':cell_name' => (string)($data['cell'] ?? $data['cell_name'] ?? ''),
        ':qty' => isset($data['qty']) && $data['qty'] !== '' ? (int)$data['qty'] : null,
        ':purpose' => (string)($data['purpose'] ?? ''),
        ':notes' => (string)($data['notes'] ?? ''),
        ':location_text' => (string)($data['locationStr'] ?? $data['location_text'] ?? ''),
        ':position_text' => (string)($data['positions'] ?? $data['position_text'] ?? ''),
        ':payload_json' => json_encode($data['payload'] ?? $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ':created_at' => normalizeTime($data['time'] ?? null),
    ]);
}

function legacyLogToPayload(array $log): array {
    switch ($log['type'] ?? '') {
        case 'take':
            $eventType = 'take_vials';
            break;
        case 'store':
            $eventType = 'store_vials';
            break;
        case 'register':
            $eventType = 'register_cell';
            break;
        case 'view':
            $eventType = 'view_cell';
            break;
        default:
            $eventType = (string)($log['type'] ?? 'event');
            break;
    }
    return [
        'event_type' => $eventType,
        'cell' => $log['cell'] ?? '',
        'qty' => $log['qty'] ?? null,
        'operator' => $log['operator'] ?? '未知',
        'purpose' => $log['purpose'] ?? '',
        'notes' => $log['notes'] ?? '',
        'locationStr' => $log['locationStr'] ?? '',
        'positions' => $log['positions'] ?? '',
        'time' => $log['time'] ?? null,
        'payload' => $log,
    ];
}

function normalizeTime($time): string {
    if (!$time) return date('c');
    if (is_numeric($time)) return date('c', (int)$time);
    $ts = strtotime((string)$time);
    return $ts ? date('c', $ts) : date('c');
}

function adminLogin(PDO $pdo, array $data) {
    $username = (string)($data['username'] ?? '');
    $password = (string)($data['password'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username=?');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        throw new RuntimeException('帳號或密碼錯誤', 401);
    }
    $_SESSION['admin_user_id'] = (int)$admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
    $pdo->prepare('UPDATE admin_users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?')->execute([(int)$admin['id']]);
}

function changeAdminPassword(PDO $pdo, array $data) {
    $old = (string)($data['old_password'] ?? '');
    $new = (string)($data['new_password'] ?? '');
    if (strlen($new) < 6) throw new RuntimeException('新密碼至少需要 6 個字元', 400);
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE id=?');
    $stmt->execute([(int)($_SESSION['admin_user_id'] ?? 0)]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify($old, $admin['password_hash'])) throw new RuntimeException('舊密碼錯誤', 401);
    $pdo->prepare('UPDATE admin_users SET password_hash=? WHERE id=?')->execute([password_hash($new, PASSWORD_DEFAULT), (int)$admin['id']]);
}

function isAdmin(): bool {
    return isset($_SESSION['admin_user_id']);
}

function requireAdmin() {
    if (!isAdmin()) throw new RuntimeException('需要管理員登入', 401);
}

function requireAdminOrPayload(PDO $pdo, array $data) {
    if (isAdmin()) return;
    $auth = $data['admin_auth'] ?? [];
    if (!is_array($auth)) throw new RuntimeException('需要管理員登入', 401);
    $username = (string)($auth['username'] ?? '');
    $password = (string)($auth['password'] ?? '');
    if ($username === '' || $password === '') throw new RuntimeException('需要管理員登入', 401);
    $stmt = $pdo->prepare('SELECT * FROM admin_users WHERE username=?');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        throw new RuntimeException('帳號或密碼錯誤', 401);
    }
    $_SESSION['admin_user_id'] = (int)$admin['id'];
    $_SESSION['admin_username'] = $admin['username'];
}

function fetchCellById(PDO $pdo, int $cellId): array {
    $stmt = $pdo->prepare('SELECT * FROM cells WHERE id=?');
    $stmt->execute([$cellId]);
    $row = $stmt->fetch();
    if (!$row) throw new RuntimeException('找不到細胞系', 404);
    return cellRowToArray($row);
}

function requireCellId(array $data): int {
    $id = $data['cell_id'] ?? $data['id'] ?? null;
    if (!is_numeric($id)) throw new RuntimeException('missing cell_id', 400);
    return (int)$id;
}

function requirePositions(array $data): array {
    $positions = $data['positions'] ?? [];
    if (is_string($positions)) $positions = array_map('trim', explode(',', $positions));
    if (!is_array($positions)) throw new RuntimeException('missing positions', 400);
    $positions = array_values(array_filter(array_map('strval', $positions), function($p) { return trim($p) !== ''; }));
    if (!$positions) throw new RuntimeException('missing positions', 400);
    return $positions;
}

function requireString(array $data, string $key): string {
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '') throw new RuntimeException("missing $key", 400);
    return $value;
}

function locText(array $loc): string {
    if (!$loc) return '';
    return trim((string)($loc['dewar'] ?? '') . '/' . (string)($loc['rack'] ?? '') . '/' . (string)($loc['box'] ?? ''), '/');
}

function jsonOut(array $data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function diagnostics(bool $probeDb = true): array {
    $drivers = class_exists('PDO') ? PDO::getAvailableDrivers() : [];
    $info = [
        'php_version' => PHP_VERSION,
        'sapi' => PHP_SAPI,
        'php_user' => get_current_user(),
        'process_user' => processUserName(),
        'dir' => __DIR__,
        'dir_exists' => is_dir(__DIR__),
        'dir_readable' => is_readable(__DIR__),
        'dir_writable' => is_writable(__DIR__),
        'db_dir' => DB_DIR,
        'db_dir_exists' => is_dir(DB_DIR),
        'db_dir_readable' => is_readable(DB_DIR),
        'db_dir_writable' => is_writable(DB_DIR),
        'db_path' => DB_PATH,
        'db_exists' => file_exists(DB_PATH),
        'db_readable' => is_readable(DB_PATH),
        'db_writable' => is_writable(DB_PATH),
        'db_size' => file_exists(DB_PATH) ? filesize(DB_PATH) : null,
        'db_perms' => file_exists(DB_PATH) ? substr(sprintf('%o', fileperms(DB_PATH)), -4) : null,
        'db_owner' => file_exists(DB_PATH) ? ownerName(fileowner(DB_PATH)) : null,
        'db_group' => file_exists(DB_PATH) ? groupName(filegroup(DB_PATH)) : null,
        'pdo_loaded' => class_exists('PDO'),
        'pdo_drivers' => $drivers,
        'sqlite_driver' => in_array('sqlite', $drivers, true),
        'sqlite3_loaded' => extension_loaded('sqlite3'),
        'post_max_size' => ini_get('post_max_size'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'memory_limit' => ini_get('memory_limit'),
    ];
    if (!$probeDb) return $info;
    $info['db_probe'] = probeDb();
    return $info;
}

function probeDb(): array {
    if (!class_exists('PDO')) return ['ok' => false, 'error' => 'PDO extension not loaded'];
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) return ['ok' => false, 'error' => 'pdo_sqlite driver not available'];
    if (!file_exists(DB_PATH)) return ['ok' => false, 'error' => 'database file not found'];
    $dsn = 'sqlite:file:' . DB_PATH . '?mode=ro&nolock=1';
    try {
        $pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $journal = (string)$pdo->query('PRAGMA journal_mode')->fetchColumn();
        $tables = (int)$pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")->fetchColumn();
        $cells = tableExists($pdo, 'cells') ? (int)$pdo->query('SELECT COUNT(*) FROM cells')->fetchColumn() : null;
        return ['ok' => true, 'dsn' => $dsn, 'journal_mode' => $journal, 'tables' => $tables, 'cells' => $cells];
    } catch (Throwable $e) {
        return ['ok' => false, 'dsn' => $dsn, 'error' => $e->getMessage()];
    }
}

function tableExists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?");
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

function processUserName(): string {
    if (!function_exists('posix_getpwuid') || !function_exists('posix_geteuid')) return 'unknown';
    $user = posix_getpwuid(posix_geteuid());
    return is_array($user) ? (string)($user['name'] ?? 'unknown') : 'unknown';
}

function ownerName($uid) {
    if ($uid === false) return null;
    if (!function_exists('posix_getpwuid')) return (string)$uid;
    $user = posix_getpwuid((int)$uid);
    return is_array($user) ? (string)($user['name'] ?? $uid) : (string)$uid;
}

function groupName($gid) {
    if ($gid === false) return null;
    if (!function_exists('posix_getgrgid')) return (string)$gid;
    $group = posix_getgrgid((int)$gid);
    return is_array($group) ? (string)($group['name'] ?? $gid) : (string)$gid;
}
