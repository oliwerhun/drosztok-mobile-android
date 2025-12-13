# iOS MANUÁLIS TESZT ÚTMUTATÓ
**Dátum:** 2025-12-06 15:50  
**Platform:** iOS 18.6 (iPhone 16 Plus Szimulátor)

---

## 🧪 TESZT #1: REGISZTRÁCIÓ

### Előfeltételek:
- ✅ iOS szimulátor fut
- ✅ Metro Bundler fut (http://localhost:8081)
- ✅ App megnyílt a szimulátorban
- ✅ Login screen látható

### Teszt adatok:
```
Email: test.ios@drosztok.hu
URH szám: 999
Rendszám: IOS123
Típus: Taxi
Jelszó: test123456
```

### Lépések:

1. **Navigálás a Register screen-re**
   - [ ] Kattints a "Nincs még fiókod? Regisztrálj!" linkre
   - [ ] Ellenőrizd: Register screen betöltődött
   - [ ] Ellenőrizd: Látható a "DROSZTOK" cím és "Regisztráció" alcím

2. **Adatok kitöltése**
   - [ ] Email mező: `test.ios@drosztok.hu`
   - [ ] URH Szám mező: `999`
   - [ ] Rendszám mező: `IOS123`
   - [ ] Típus picker: `Taxi`
   - [ ] Jelszó mező: `test123456`
   - [ ] Jelszó megerősítés: `test123456`

3. **Regisztráció gomb megnyomása**
   - [ ] Kattints a "Regisztráció" gombra
   - [ ] Ellenőrizd: Loading indicator megjelenik
   - [ ] Várj 2-3 másodpercet

4. **Elvárt eredmény:**
   - [ ] Sikeres regisztráció
   - [ ] Automatikus navigáció a Pending Approval screen-re
   - [ ] Látható üzenet: "A fiókod adminisztrátori jóváhagyásra vár"
   - [ ] Látható a "Kijelentkezés" gomb

5. **Ellenőrzés Firebase-ben:**
   - [ ] Nyisd meg: https://console.firebase.google.com/project/elitdroszt-597f4/firestore
   - [ ] Navigálj: `users` collection
   - [ ] Ellenőrizd: Új user létrejött
   - [ ] Ellenőrizd: `email: test.ios@drosztok.hu`
   - [ ] Ellenőrizd: `urhNumber: "999"`
   - [ ] Ellenőrizd: `licensePlate: "IOS123"`
   - [ ] Ellenőrizd: `userType: "Taxi"`
   - [ ] Ellenőrizd: `status: "pending"`
   - [ ] Ellenőrizd: `role: "user"` (vagy "admin" ha ez az első user)

### Lehetséges hibák:

**Hiba #1: "URH szám már használatban van"**
- **Ok:** A 999-es URH szám már létezik
- **Megoldás:** Használj másik számot (pl. 998, 997)

**Hiba #2: "Érvénytelen email formátum"**
- **Ok:** Email formátum nem megfelelő
- **Megoldás:** Ellenőrizd az email formátumot

**Hiba #3: "Jelszó túl rövid"**
- **Ok:** Jelszó kevesebb mint 6 karakter
- **Megoldás:** Használj legalább 6 karakteres jelszót

**Hiba #4: "Érvénytelen rendszám formátum"**
- **Ok:** Rendszám nem ABC123 vagy ABCD123 formátum
- **Megoldás:** Használj helyes formátumot (pl. IOS123, TEST12)

---

## 🧪 TESZT #2: ADMIN JÓVÁHAGYÁS (Firebase Console)

### Lépések:

1. **Firebase Console megnyitása**
   - [ ] Nyisd meg: https://console.firebase.google.com/project/elitdroszt-597f4/firestore
   - [ ] Navigálj: `users` collection
   - [ ] Keresd meg a `test.ios@drosztok.hu` user-t

2. **User jóváhagyása**
   - [ ] Kattints a user dokumentumra
   - [ ] Szerkesztés mód
   - [ ] Változtasd: `status: "pending"` → `status: "approved"`
   - [ ] Mentés

3. **App újratöltése iOS-en**
   - [ ] iOS szimulátorban: Cmd+R (reload)
   - [ ] VAGY Metro terminálban: 'r' betű

4. **Elvárt eredmény:**
   - [ ] Automatikus navigáció a Dashboard-ra
   - [ ] PermissionGuard megjelenik
   - [ ] Látható a varázsló első lépése (Helyzet engedély)

---

## 🧪 TESZT #3: PERMISSIONGUARD (iOS-SPECIFIKUS)

### Előfeltételek:
- ✅ User jóváhagyva (status: "approved")
- ✅ Dashboard betöltődött
- ✅ PermissionGuard megjelent

### Ellenőrizendő:

1. **Varázsló lépések száma (iOS-specifikus)**
   - [ ] Ellenőrizd: Csak 2 lépés van (nem 4!)
   - [ ] Lépés 1: Helyzet engedély
   - [ ] Lépés 2: Értesítés engedély
   - [ ] NINCS: Unused Apps lépés (Android-specifikus)
   - [ ] NINCS: Akkumulátor lépés (Android-specifikus)

2. **Lépés 1: Helyzet engedély**
   - [ ] Látható cím: "Helyzet engedély szükséges"
   - [ ] Látható gomb: "Engedélyezés"
   - [ ] Kattints az "Engedélyezés" gombra
   - [ ] iOS natív dialógus megjelenik
   - [ ] Válaszd: "Allow While Using App" vagy "Allow Once"
   - [ ] Ellenőrizd: Zöld pipa megjelenik ✅
   - [ ] Ellenőrizd: "Következő" gomb aktiválódik

3. **Lépés 2: Értesítés engedély**
   - [ ] Kattints a "Következő" gombra
   - [ ] Látható cím: "Értesítés engedély szükséges"
   - [ ] Látható gomb: "Engedélyezés"
   - [ ] Kattints az "Engedélyezés" gombra
   - [ ] iOS natív dialógus megjelenik
   - [ ] Válaszd: "Allow"
   - [ ] Ellenőrizd: Zöld pipa megjelenik ✅
   - [ ] Ellenőrizd: "Folytatás" gomb aktiválódik

4. **Befejezés**
   - [ ] Kattints a "Folytatás" gombra
   - [ ] Ellenőrizd: PermissionGuard eltűnik
   - [ ] Ellenőrizd: Dashboard megjelenik
   - [ ] Ellenőrizd: Tab bar látható (Akadémia, Belváros, stb.)

### iOS vs Android különbségek ellenőrzése:

**iOS (KELL):**
- ✅ 2 lépéses varázsló
- ✅ Helyzet engedély
- ✅ Értesítés engedély
- ✅ NINCS Mock Location ellenőrzés
- ✅ NINCS Unused Apps lépés
- ✅ NINCS Akkumulátor lépés

**Android (összehasonlításként):**
- 4 lépéses varázsló
- Helyzet engedély
- Értesítés engedély
- Unused Apps engedély
- Akkumulátor optimalizálás
- Mock Location ellenőrzés (blokkoló piros képernyő)

---

## 🧪 TESZT #4: DASHBOARD NAVIGÁCIÓ

### Lépések:

1. **Tab bar ellenőrzése**
   - [ ] Látható tabok: Akadémia, Belváros, Budai, Conti, Crowne, Kozmo, Reptér
   - [ ] Látható: Profil tab (jobb szélen)
   - [ ] NINCS látható: V-Osztály tab (csak V-Osztály típusú user-eknek)
   - [ ] NINCS látható: 213-as tab (csak VIP/VIP Kombi user-eknek)

2. **Tab váltás tesztelése**
   - [ ] Kattints az "Akadémia" tabra
   - [ ] Ellenőrizd: Akadémia screen betöltődött
   - [ ] Ellenőrizd: Látható a taxiállomás neve
   - [ ] Ellenőrizd: Látható a "Check-in" gomb
   - [ ] Kattints a "Belváros" tabra
   - [ ] Ellenőrizd: Belváros screen betöltődött
   - [ ] Ismételd meg minden tabbal

3. **Profil tab**
   - [ ] Kattints a "Profil" tabra
   - [ ] Ellenőrizd: Profil screen betöltődött
   - [ ] Ellenőrizd: Látható a felhasználó adatai
   - [ ] Ellenőrizd: Email: test.ios@drosztok.hu
   - [ ] Ellenőrizd: URH: 999
   - [ ] Ellenőrizd: Rendszám: IOS123
   - [ ] Ellenőrizd: Típus: Taxi
   - [ ] Ellenőrizd: Látható a "Kijelentkezés" gomb

---

## 🧪 TESZT #5: CHECK-IN/CHECK-OUT

### Lépések:

1. **Check-in tesztelése**
   - [ ] Navigálj az "Akadémia" tabra
   - [ ] Kattints a "Check-in" gombra
   - [ ] Ellenőrizd: Loading indicator megjelenik
   - [ ] Várj 1-2 másodpercet
   - [ ] Ellenőrizd: "Check-out" gomb megjelenik
   - [ ] Ellenőrizd: A saját neved megjelenik a listában
   - [ ] Ellenőrizd: URH szám látható (999)
   - [ ] Ellenőrizd: Rendszám látható (IOS123)

2. **Firebase ellenőrzés**
   - [ ] Nyisd meg Firebase Console
   - [ ] Navigálj: `locations/akademia` dokumentum
   - [ ] Ellenőrizd: `members` array tartalmazza a user-t
   - [ ] Ellenőrizd: `uid`, `username`, `licensePlate`, `userType` mezők helyesek

3. **Check-out tesztelése**
   - [ ] Kattints a "Check-out" gombra
   - [ ] Ellenőrizd: Loading indicator megjelenik
   - [ ] Várj 1-2 másodpercet
   - [ ] Ellenőrizd: "Check-in" gomb megjelenik
   - [ ] Ellenőrizd: A neved eltűnik a listából

4. **Firebase ellenőrzés**
   - [ ] Frissítsd a Firebase Console-t
   - [ ] Ellenőrizd: `members` array NEM tartalmazza a user-t

---

## 🧪 TESZT #6: LOCATION TRACKING (iOS)

### Lépések:

1. **Location permission ellenőrzése**
   - [ ] iOS Settings → Privacy & Security → Location Services
   - [ ] Keresd meg: "drosztokmobile"
   - [ ] Ellenőrizd: Engedély megadva

2. **Háttér location tracking**
   - [ ] Check-in az "Akadémia" állomásra
   - [ ] Nyomj Home gombot (Cmd+Shift+H)
   - [ ] Várj 1-2 percet
   - [ ] Nyisd meg újra az appot
   - [ ] Ellenőrizd: Még mindig be vagy jelentkezve

3. **Location logok ellenőrzése**
   - [ ] Metro terminálban nézd a logokat
   - [ ] Keress: "Location update" vagy "GPS" üzeneteket
   - [ ] Ellenőrizd: Location frissítések érkeznek

---

## 📊 TESZT EREDMÉNYEK ÖSSZESÍTŐ

| Teszt | Státusz | Megjegyzés |
|-------|---------|------------|
| Regisztráció | ⏳ | Tesztelendő |
| Admin jóváhagyás | ⏳ | Tesztelendő |
| PermissionGuard (iOS) | ⏳ | Tesztelendő |
| Dashboard navigáció | ⏳ | Tesztelendő |
| Check-in/Check-out | ⏳ | Tesztelendő |
| Location tracking | ⏳ | Tesztelendő |

---

## 📝 MEGJEGYZÉSEK

### Fontos iOS-specifikus dolgok:

1. **Location Permission:**
   - iOS-en 3 opció van: "Never", "While Using", "Always"
   - Háttér tracking-hez "Always" kell
   - Első kéréskor csak "While Using" vagy "Never" választható
   - "Always" csak később, használat közben kérhető

2. **Notification Permission:**
   - iOS-en egyszer kérhető
   - Ha "Don't Allow"-t választasz, csak Settings-ben változtatható
   - Teszteléshez: Settings → Notifications → drosztokmobile

3. **Szimulátor Location:**
   - Szimulátor alapértelmezetten nincs GPS
   - Features → Location → Custom Location (pl. Budapest koordináták)
   - Vagy: Features → Location → Apple (Cupertino)

4. **Reload app:**
   - Cmd+R az iOS szimulátorban
   - Vagy 'r' a Metro terminálban

---

**KÖVETKEZŐ LÉPÉS:** Kövesd a fenti útmutatót és dokumentáld az eredményeket!
