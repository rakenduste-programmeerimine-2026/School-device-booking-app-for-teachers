# School-device-booking-app-for-teachers

## Andmebaas

### Seadmed
- `device_types`: seadme nimi ja koguarv (`total_quantity`). Seadet ei kustutata, vaid admin arhiveerib selle (`archived_at`). Arhiveerimise saab tagasi võtta.
- Arhiveeritud seadet ei saa uuesti broneerida ega olemasolevat broneeringut sellele seadmele tõsta. Vanad broneeringud säilivad ja neid saab endiselt parandada.
- Seadet, millel on broneeringuid, ei saa kustutada.
- **Otsus:** kui admin vähendab koguarvu alla juba broneeritud koguse (näiteks läks seadmeid katki), muudatus lubatakse ja olemasolevad broneeringud jäävad alles. Vabade seadmete arv näitab siis 0, mitte negatiivset arvu, ja admin lahendab ülebroneeritud päevad ülevaates.

### Õppeaasta ja õppetöövabad ajad
- `school_years`: õppeaasta algus- ja lõppkuupäev (`starts_on`, `ends_on`). Õppeaastad ei tohi kattuda.
- `non_teaching_periods`: õppetöövabad perioodid õppeaasta sees. Igal perioodil on tüüp (`break` = koolivaheaeg, `public_holiday` = riigipüha, `day_off` = õppetöövaba päev), nimi ning algus- ja lõppkuupäev.
- Kuupäevad on kaasaarvatud: periood 2026-10-26 kuni 2026-11-01 hõlmab mõlemat päeva. Ühepäevasel pühal on algus- ja lõppkuupäev sama.
- Kõik sisseloginud kasutajad saavad neid lugeda, muuta saab ainult admin.

### Koolitunnid
- `lesson_periods`: tunni number (`lesson_number`, unikaalne) ning algus- ja lõpuaeg (`starts_time`, `ends_time`) Tallinna kellaajana, näiteks 1. tund 08:15–09:00.
- Tunni valimine täidab ainult broneeringu algus- ja lõpuaja. Broneering salvestab alati tavalise algus- ja lõpuaja, nii et vabalt valitud ajad toimivad samamoodi.
- Kõik sisseloginud kasutajad saavad tunde lugeda, muuta saab ainult admin.
