<?php
declare(strict_types=1);

define('DB_DIR', __DIR__ . '/db');
define('BACKUP_DIR', __DIR__ . '/backups');
define('DB_PATH', getenv('CELLSTOCK_DB_PATH') ?: DB_DIR . '/cellstock.sqlite');

$customDbPath = getenv('CELLSTOCK_DB_PATH') !== false && getenv('CELLSTOCK_DB_PATH') !== '';
$adminUsername = getenv('CELLSTOCK_ADMIN_USERNAME') ?: 'admin';
$adminPasswordConfigured = getenv('CELLSTOCK_ADMIN_PASSWORD') !== false && getenv('CELLSTOCK_ADMIN_PASSWORD') !== '';
$labName = getenv('CELLSTOCK_LAB_NAME') ?: 'FCT lab';

$checks = [];

// PHP version
$phpVer = PHP_VERSION;
$phpOk  = version_compare($phpVer, '8.0.0', '>=');
$checks[] = ['name' => 'PHP 版本', 'value' => $phpVer, 'ok' => $phpOk,
             'hint' => $phpOk ? '' : '需要 PHP 8.0 以上，請在 Web Station 選擇正確的 PHP 版本'];

// PDO SQLite
$pdoOk = class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true);
$checks[] = ['name' => 'PDO SQLite 驅動', 'value' => $pdoOk ? '已載入' : '未載入', 'ok' => $pdoOk,
             'hint' => $pdoOk ? '' : '請在 Web Station PHP Profile 中啟用 pdo_sqlite 擴充套件'];

// SQLite3 extension (optional — this app only uses pdo_sqlite, never the standalone SQLite3 class)
$sq3Ok = extension_loaded('sqlite3');
$checks[] = ['name' => 'SQLite3 擴充套件', 'value' => $sq3Ok ? '已載入' : '未載入（非必需）', 'ok' => true,
             'hint' => $sq3Ok ? '' : '本系統只需要 pdo_sqlite，這個擴充套件沒裝不影響使用'];

// Session
$sessOk = function_exists('session_start');
$checks[] = ['name' => 'Session 支援', 'value' => $sessOk ? '正常' : '不可用', 'ok' => $sessOk,
             'hint' => $sessOk ? '' : '請確認 PHP Session 模組已啟用'];

// db/ directory
$dbDirExists   = is_dir(DB_DIR);
$dbDirWritable = $dbDirExists && is_writable(DB_DIR);
if (!$dbDirExists) {
    @mkdir(DB_DIR, 0775, true);
    $dbDirExists   = is_dir(DB_DIR);
    $dbDirWritable = $dbDirExists && is_writable(DB_DIR);
}
$checks[] = ['name' => $customDbPath ? 'db/ 目錄存在' : 'db/ 目錄可寫入',
             'value' => $customDbPath ? ($dbDirExists ? '正常 (' . DB_DIR . ')' : '不存在') : ($dbDirWritable ? '正常 (' . DB_DIR . ')' : '無法寫入'),
             'ok' => $customDbPath ? $dbDirExists : $dbDirWritable,
             'hint' => $customDbPath ? ($dbDirExists ? '' : 'db/ 內含 schema.sql，請確認部署檔案完整') : ($dbDirWritable ? '' : '請執行：chmod 775 db/  並確認 web server 使用者（http）有寫入權限')];

$dbParent = dirname(DB_PATH);
$dbParentExists = is_dir($dbParent);
$dbParentWritable = $dbParentExists && is_writable($dbParent);
if (!$dbParentExists) {
    @mkdir($dbParent, 0775, true);
    $dbParentExists = is_dir($dbParent);
    $dbParentWritable = $dbParentExists && is_writable($dbParent);
}
$checks[] = ['name' => '資料庫路徑目錄可寫入', 'value' => $dbParentWritable ? '正常 (' . $dbParent . ')' : '無法寫入', 'ok' => $dbParentWritable,
             'hint' => $dbParentWritable ? '' : '請確認 CELLSTOCK_DB_PATH 所在目錄可由 web server 寫入'];

// db file
$dbExists   = file_exists(DB_PATH);
$dbWritable = $dbExists && is_writable(DB_PATH);
if ($dbExists) {
    $checks[] = ['name' => 'SQLite 資料庫檔案', 'value' => $dbWritable ? '存在且可寫入' : '存在但無法寫入', 'ok' => $dbWritable,
                 'hint' => $dbWritable ? '' : '請執行：chmod 664 db/cellstock.sqlite'];
} else {
    $checks[] = ['name' => 'SQLite 資料庫檔案', 'value' => '尚未建立（首次執行時自動建立）', 'ok' => $dbDirWritable,
                 'hint' => $dbDirWritable ? '' : '需要 db/ 目錄可寫入才能自動建立資料庫'];
}

// backups/ directory
$bkDirExists   = is_dir(BACKUP_DIR);
$bkDirWritable = $bkDirExists && is_writable(BACKUP_DIR);
if (!$bkDirExists) {
    @mkdir(BACKUP_DIR, 0775, true);
    $bkDirExists   = is_dir(BACKUP_DIR);
    $bkDirWritable = $bkDirExists && is_writable(BACKUP_DIR);
}
$checks[] = ['name' => 'backups/ 目錄可寫入', 'value' => $bkDirWritable ? '正常' : '無法寫入', 'ok' => $bkDirWritable,
             'hint' => $bkDirWritable ? '' : '請執行：chmod 775 backups/'];

// post_max_size
$postMax = ini_get('post_max_size');
$checks[] = ['name' => 'post_max_size', 'value' => $postMax, 'ok' => true, 'hint' => '建議 32M 以上，用於匯入 CSV'];

// Web server user
$wsUser = function_exists('posix_getpwuid') ? (posix_getpwuid(posix_geteuid())['name'] ?? '?') : get_current_user();
$checks[] = ['name' => 'Web Server 執行身份', 'value' => $wsUser, 'ok' => true, 'hint' => 'db/ 目錄需要此使用者有寫入權限'];

$allOk = array_reduce($checks, fn($c, $i) => $c && $i['ok'], true);

// Try to probe DB
$dbProbe = null;
if ($pdoOk && $dbExists) {
    try {
        $pdo = new PDO('sqlite:' . DB_PATH, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $row = $pdo->query("SELECT COUNT(*) as n FROM cells")->fetch();
        $dbProbe = ['ok' => true, 'cells' => $row['n']];
    } catch (Throwable $e) {
        $dbProbe = ['ok' => false, 'error' => $e->getMessage()];
    }
}
?>
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cell Stock Manager — 安裝檢查</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:40px 20px}
.container{max-width:680px;margin:0 auto}
h1{font-size:22px;font-weight:700;color:#4ade80;margin-bottom:4px}
.subtitle{font-size:13px;color:#94a3b8;margin-bottom:32px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:20px}
.card-title{font-size:13px;font-weight:600;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase;margin-bottom:16px}
.check-row{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #1e293b}
.check-row:last-child{border-bottom:none}
.icon{font-size:16px;flex-shrink:0;margin-top:1px}
.check-name{font-size:14px;color:#cbd5e1;min-width:180px;flex-shrink:0}
.check-val{font-size:13px;font-family:monospace;color:#e2e8f0;flex:1}
.check-hint{font-size:12px;color:#f87171;margin-top:3px}
.ok{color:#4ade80}
.fail{color:#f87171}
.warn{color:#fbbf24}
.banner{border-radius:10px;padding:16px 20px;margin-bottom:20px;font-size:15px;font-weight:600;display:flex;align-items:center;gap:10px}
.banner.ok{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#4ade80}
.banner.fail{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171}
.cred-box{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;margin-top:12px}
.cred-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px}
.cred-label{color:#94a3b8}
.cred-val{font-family:monospace;color:#fbbf24;font-size:15px;font-weight:600}
.btn{display:inline-block;padding:12px 28px;background:#4ade80;color:#0f172a;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-top:16px}
.warn-box{background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:12px 16px;font-size:13px;color:#fbbf24;margin-top:12px}
</style>
</head>
<body>
<div class="container">
  <h1>🧬 Cell Stock Manager</h1>
  <div class="subtitle">安裝環境檢查</div>

  <div class="banner <?= $allOk ? 'ok' : 'fail' ?>">
    <?= $allOk ? '✅ 環境檢查通過，可以正常使用' : '❌ 部分項目需要修正，請參考下方提示' ?>
  </div>

  <div class="card">
    <div class="card-title">環境需求</div>
    <?php foreach ($checks as $c): ?>
    <div class="check-row">
      <span class="icon"><?= $c['ok'] ? '✅' : '❌' ?></span>
      <div style="flex:1">
        <div style="display:flex;gap:12px;align-items:baseline">
          <span class="check-name"><?= htmlspecialchars($c['name']) ?></span>
          <span class="check-val <?= $c['ok'] ? 'ok' : 'fail' ?>"><?= htmlspecialchars($c['value']) ?></span>
        </div>
        <?php if ($c['hint']): ?>
        <div class="check-hint">→ <?= htmlspecialchars($c['hint']) ?></div>
        <?php endif; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </div>

  <?php if ($dbProbe): ?>
  <div class="card">
    <div class="card-title">資料庫狀態</div>
    <?php if ($dbProbe['ok']): ?>
    <div style="font-size:14px;color:#4ade80">✅ 資料庫連線正常，目前已有 <strong><?= $dbProbe['cells'] ?></strong> 筆細胞系資料</div>
    <?php else: ?>
    <div style="font-size:14px;color:#f87171">❌ 資料庫連線失敗：<?= htmlspecialchars($dbProbe['error']) ?></div>
    <?php endif; ?>
  </div>
  <?php endif; ?>

  <div class="card">
    <div class="card-title">預設管理員帳號</div>
    <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">首次安裝會使用環境變數建立管理員。若資料庫已存在，環境變數不會覆蓋既有帳號密碼。</div>
    <div class="cred-box">
      <div class="cred-row"><span class="cred-label">帳號</span><span class="cred-val"><?= htmlspecialchars($adminUsername) ?></span></div>
      <div class="cred-row"><span class="cred-label">密碼來源</span><span class="cred-val"><?= $adminPasswordConfigured ? 'CELLSTOCK_ADMIN_PASSWORD' : '內建預設值' ?></span></div>
      <div class="cred-row"><span class="cred-label">實驗室名稱</span><span class="cred-val"><?= htmlspecialchars($labName) ?></span></div>
    </div>
    <div class="warn-box">⚠️ Docker 部署請設定 CELLSTOCK_ADMIN_PASSWORD；實驗室名稱可用 CELLSTOCK_LAB_NAME 設定。</div>
  </div>

  <?php if ($allOk): ?>
  <a class="btn" href="cell-stock-manager.html">→ 進入細胞庫存管理系統</a>
  <?php endif; ?>

  <div style="margin-top:24px;font-size:12px;color:#475569;text-align:center">
    確認環境正常後，可刪除此 setup.php 檔案以避免資訊外洩。
  </div>
</div>
</body>
</html>
