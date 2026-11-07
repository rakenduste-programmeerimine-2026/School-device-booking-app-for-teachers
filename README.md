# School-device-booking-app-for-teachers

## Andmebaas

### Õppeaasta ja õppetöövabad ajad
- `school_years`: õppeaasta algus- ja lõppkuupäev (`starts_on`, `ends_on`). Õppeaastad ei tohi kattuda.
- `non_teaching_periods`: õppetöövabad perioodid õppeaasta sees. Igal perioodil on tüüp (`break` = koolivaheaeg, `public_holiday` = riigipüha, `day_off` = õppetöövaba päev), nimi ning algus- ja lõppkuupäev.
- Kuupäevad on kaasaarvatud: periood 2026-10-26 kuni 2026-11-01 hõlmab mõlemat päeva. Ühepäevasel pühal on algus- ja lõppkuupäev sama.
- Kõik sisseloginud kasutajad saavad neid lugeda, muuta saab ainult admin.

### Koolitunnid
- `lesson_periods`: tunni number (`lesson_number`, unikaalne) ning algus- ja lõpuaeg (`starts_time`, `ends_time`) Tallinna kellaajana, näiteks 1. tund 08:15–09:00.
- Tunni valimine täidab ainult broneeringu algus- ja lõpuaja. Broneering salvestab alati tavalise algus- ja lõpuaja, nii et vabalt valitud ajad toimivad samamoodi.
- Kõik sisseloginud kasutajad saavad tunde lugeda, muuta saab ainult admin.

### Näidisandmed
`supabase db reset` laeb pärast migratsioone faili `supabase/seed.sql`. Kõik väärtused on näidised ja need tuleb enne pilooti asendada kooli päris andmetega.
- Seadmed: Sülearvuti 30, Tahvelarvuti 20, LEGO WeDo 2.0 12, LEGO SPIKE 12, Ozobot 15, DJI Tello EDU 6, 3D-printer 1, Cricut 1. Kogused muutuvad pärast kooli inventuuri.
- Õppeaasta 2026-09-01 kuni 2027-06-05 ning vaheajad: sügisvaheaeg 2026-10-26 kuni 2026-11-01, jõuluvaheaeg 2026-12-23 kuni 2027-01-02, kevadvaheaeg 2027-03-22 kuni 2027-03-28.
- Koolitunnid 1–8: 08:15–09:00, 09:10–09:55, 10:05–10:50, 11:00–11:45, 12:15–13:00, 13:10–13:55, 14:05–14:50, 15:00–15:45.
