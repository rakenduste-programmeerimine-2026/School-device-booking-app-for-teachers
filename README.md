# School-device-booking-app-for-teachers

## Andmebaas

### Õppeaasta ja õppetöövabad ajad
- `school_years`: õppeaasta algus- ja lõppkuupäev (`starts_on`, `ends_on`). Õppeaastad ei tohi kattuda.
- `non_teaching_periods`: õppetöövabad perioodid õppeaasta sees. Igal perioodil on tüüp (`break` = koolivaheaeg, `public_holiday` = riigipüha, `day_off` = õppetöövaba päev), nimi ning algus- ja lõppkuupäev.
- Kuupäevad on kaasaarvatud: periood 2026-10-26 kuni 2026-11-01 hõlmab mõlemat päeva. Ühepäevasel pühal on algus- ja lõppkuupäev sama.
- Kõik sisseloginud kasutajad saavad neid lugeda, muuta saab ainult admin.

### Koolitunnid
- `lesson_periods`: tunni number (`lesson_number`, unikaalne) ning algus- ja lõpuaeg (`starts_at`, `ends_at`) Tallinna kellaajana, näiteks 1. tund 08:15–09:00.
- Tunni valimine täidab ainult broneeringu algus- ja lõpuaja. Broneering salvestab alati tavalise algus- ja lõpuaja, nii et vabalt valitud ajad toimivad samamoodi.
- Kõik sisseloginud kasutajad saavad tunde lugeda, muuta saab ainult admin.
