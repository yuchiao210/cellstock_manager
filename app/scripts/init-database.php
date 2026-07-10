<?php
declare(strict_types=1);

const PROJECT_ROOT = __DIR__ . '/..';
const DEFAULT_DB_PATH = PROJECT_ROOT . '/db/cellstock.sqlite';
const SCHEMA_PATH = PROJECT_ROOT . '/db/schema.sql';

$dbPath = getenv('CELLSTOCK_DB_PATH') ?: DEFAULT_DB_PATH;
$adminUser = getenv('CELLSTOCK_ADMIN_USERNAME') ?: 'admin';
$adminPassword = getenv('CELLSTOCK_ADMIN_PASSWORD') ?: 'LabAdmin2026!';
$force = in_array(strtolower((string)(getenv('CELLSTOCK_INIT_FORCE') ?: '')), ['1', 'true', 'yes'], true);

if ($adminPassword === '') {
    fwrite(STDERR, "CELLSTOCK_ADMIN_PASSWORD must not be empty.\n");
    exit(1);
}

$dbDir = dirname($dbPath);
if (!is_dir($dbDir) && !mkdir($dbDir, 0775, true) && !is_dir($dbDir)) {
    fwrite(STDERR, "Unable to create database directory: {$dbDir}\n");
    exit(1);
}

if ($force && file_exists($dbPath) && !unlink($dbPath)) {
    fwrite(STDERR, "Unable to remove existing database: {$dbPath}\n");
    exit(1);
}

$schema = file_get_contents(SCHEMA_PATH);
if ($schema === false) {
    fwrite(STDERR, "Unable to read schema file: " . SCHEMA_PATH . "\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('PRAGMA foreign_keys = ON');

$createdAdmin = false;
$pdo->beginTransaction();
try {
    $pdo->exec($schema);
    $pdo->prepare('INSERT OR IGNORE INTO migrations(name) VALUES(?)')->execute(['legacy_json_import_v1']);

    $count = (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('INSERT INTO admin_users(username, password_hash) VALUES(?, ?)');
        $stmt->execute([$adminUser, password_hash($adminPassword, PASSWORD_DEFAULT)]);
        $createdAdmin = true;
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "Database initialization failed: {$e->getMessage()}\n");
    exit(1);
}

if ($createdAdmin) {
    echo "Initialized empty Cell Stock database at {$dbPath}\n";
    echo "Created admin user: {$adminUser}\n";
} else {
    echo "Database already initialized at {$dbPath}; existing admin users were left unchanged.\n";
}
