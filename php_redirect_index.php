<?php
// Megkeressük az összes .apk fájlt a mappában
$files = glob('*.apk');

// Ha nincs fájl, hibaüzenet
if (count($files) === 0) {
    die("Jelenleg nincs letölthető alkalmazás.");
}

// Rendezzük őket módosítási dátum szerint (a legfrissebb kerül előre)
usort($files, function($a, $b) {
    return filemtime($b) - filemtime($a);
});

// A legújabb fájl kiválasztása
$latest_file = $files[0];

// Letöltés indítása (átirányítás)
header('Location: ' . $latest_file);
exit;
?>
