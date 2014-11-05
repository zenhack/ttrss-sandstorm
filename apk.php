<?php
$file = 'app.apk';

if (file_exists($file)) {
    header('Content-Disposition: attachment; filename="tinytinyrss.apk";');
    header('Content-Type: application/vnd.android.package-archive');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}
?>
