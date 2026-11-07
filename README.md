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

### Ligipääs ja lubatud e-postid
- `allowed_emails`: ainult siin olevate e-postidega saab sisse logida.
- E-posti eemaldamisel blokeeritakse kasutaja ja tema sessioonid lõpetatakse. Ta ei saa uuesti sisse logida ega sessiooni pikendada. Juba väljastatud pääsutõend kehtib kuni aegumiseni, kõige rohkem 1 tund.
- E-posti uuesti lisamisel saab kasutaja jälle sisse logida.
- Rolli muutmine (sama e-post) kasutajat välja ei logi. E-posti muutmisel blokeeritakse vana aadress ja uus saab ligipääsu.
- Kasutajat, tema profiili, broneeringuid ega ajalugu ei kustutata.

### Kasutajate nimed
- `profiles`: õpetaja näeb ainult enda profiili (e-post, roll), admin näeb kõiki.
- `profile_names`: vaade, kust iga sisseloginud kasutaja saab lugeda kõigi kasutajate nimesid (`id`, `full_name`), et näha, kes broneeris. Teiste e-post ja roll jäävad varjatuks. Sisselogimata kasutaja nimesid ei näe.
- Supabase'i linter märgib `profile_names` hoiatusega "security definer view". See on teadlik valik: vaade loeb `profiles` tabelit omaniku õigustega, et näidata ka teiste nimesid, ja sellepärast tohib vaates olla ainult `id` ja `full_name`. Ära "paranda" seda `security_invoker = true` peale, muidu näeb õpetaja jälle ainult enda nime.

### Broneeringute muutuste ajalugu
- `booking_changes`: iga broneeringu loomine, muutmine ja kustutamine salvestub automaatselt (päästik tabelil `bookings`): kes (`changed_by`), millal (`changed_at`), toiming (`created`, `updated`, `deleted`) ning andmed enne ja pärast (`old_data`, `new_data`).
- Ajalugu säilib ka pärast broneeringu või terve sarja kustutamist.
- Muudatus, mis ei muuda ühtegi välja, ajalukku ei lähe.
- `changed_at` on tehingu algusaeg, nii et ühe hulgimuudatuse kõigil ridadel on sama aeg. Järjesta ajalugu `changed_at` ja seejärel `id` järgi.
- Ajalugu saab lugeda ainult admin. Keegi ei saa seda rakendusest lisada, muuta ega kustutada.

### Näidisandmed
`supabase db reset` laeb pärast migratsioone faili `supabase/seed.sql`. Kõik väärtused on näidised ja need tuleb enne pilooti asendada kooli päris andmetega.
- Seadmed: Sülearvuti 30, Tahvelarvuti 20, LEGO WeDo 2.0 12, LEGO SPIKE 12, Ozobot 15, DJI Tello EDU 6, 3D-printer 1, Cricut 1. Kogused muutuvad pärast kooli inventuuri.
- Õppeaasta 2026-09-01 kuni 2027-06-05 ning vaheajad: sügisvaheaeg 2026-10-26 kuni 2026-11-01, jõuluvaheaeg 2026-12-23 kuni 2027-01-02, kevadvaheaeg 2027-03-22 kuni 2027-03-28.
- Koolitunnid 1–8: 08:15–09:00, 09:10–09:55, 10:05–10:50, 11:00–11:45, 12:15–13:00, 13:10–13:55, 14:05–14:50, 15:00–15:45.
