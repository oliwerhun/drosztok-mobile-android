# KRITIKUS PROBLÉMA - 2025-11-22

## Tünet
- App splash screen-en ragad
- "drosztok-mobile" felirat látható
- Nem töltődik be a Login screen
- Hiba: `java.lang.String cannot be cast to java.lang.Boolean`

## Próbált megoldások
1. ✗ Metro restart --localhost --clear
2. ✗ app.json tisztítás (newArchEnabled, predictiveBackGestureEnabled törlés)
3. ✗ node_modules törlés + reinstall
4. ✗ .expo, android, ios törlés

## Következő lépések
- Expo prebuild + natív build
- Vagy Expo SDK downgrade 53-ra
- Vagy teljesen új projekt máshol (nem ~/drosztok-mobile)
