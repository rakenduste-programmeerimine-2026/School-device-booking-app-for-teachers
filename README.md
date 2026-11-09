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
- E-posti eemaldamisel blokeeritakse kasutaja ja tema sessioonid lõpetatakse. Ta ei saa uuesti sisse logida ega sessiooni pikendada.
- **Ooteaeg kuni 1 tund:** juba väljastatud pääsutõend kehtib kuni aegumiseni (`jwt_expiry`, 1 tund). Selle aja jooksul saab eemaldatud kasutaja veel andmeid lugeda ja kirjutavaid funktsioone kutsuda; eemaldatud admin ka seadmeid muuta. Kirjutavad funktsioonid (#8 ja edasi) kontrollivad seepärast ka lubatud e-postide nimekirja.
- E-posti uuesti lisamisel saab kasutaja jälle sisse logida. Muul põhjusel (näiteks käsitsi) pandud blokeeringut see ei tühista.
- Rolli muutmine (sama e-post) kasutajat välja ei logi.
- E-posti muutmisel blokeeritakse vana aadress ja uus saab ligipääsu. Uue aadressiga sisse logides tekib **uus konto**: vanad broneeringud jäävad vana, blokeeritud konto juurde.
- Viimast admini ei saa nimekirjast eemaldada ega õpetajaks muuta, muidu ei pääseks keegi adminitöövahenditesse.
- Kasutajat, tema profiili, broneeringuid ega ajalugu ei kustutata.

### Kasutajate nimed
- `profiles`: õpetaja näeb ainult enda profiili (e-post, roll), admin näeb kõiki.
- `profile_names`: vaade, kust iga sisseloginud kasutaja saab lugeda kõigi kasutajate nimesid (`id`, `full_name`), et näha, kes broneeris. Teiste e-post ja roll jäävad varjatuks. Sisselogimata kasutaja nimesid ei näe.
- Supabase'i linter märgib `profile_names` hoiatusega "security definer view". See on teadlik valik: vaade loeb `profiles` tabelit omaniku õigustega, et näidata ka teiste nimesid, ja sellepärast tohib vaates olla ainult `id` ja `full_name`. Ära "paranda" seda `security_invoker = true` peale, muidu näeb õpetaja jälle ainult enda nime.

### Broneerimine
- `create_booking(device_type_id, quantity, starts_at, ends_at)` loob ühe broneeringu (ühe broneeringuga sarja) ja tagastab broneeringu id. Kliendid ei kirjuta tabelisse `bookings` otse, vaid ainult selle funktsiooni kaudu.
- Funktsioon lukustab seadme rea (`FOR UPDATE`), nii et samaaegsed broneeringud samale seadmele ootavad üksteist ega saa kunagi koguarvu ületada.
- Mahtu kontrollitakse **tipukasutuse** järgi: loeb, mitu seadet on samal ajal kasutusel, mitte kõigi kattuvate broneeringute summa. Järjestikused tunnid (näiteks 09:00–10:00 ja 10:00–11:00) ei konflikteeru.
- Vead (tagastatakse veateatena): `not_authenticated`, `access_revoked` (e-post pole enam lubatud nimekirjas), `invalid_quantity`, `invalid_range`, `device_type_not_found`, `device_type_archived`, `insufficient_capacity` (detailis `available=N`). Vea korral ei kirjutata ühtegi rida.
- `available_quantity(device_type_id, starts_at, ends_at)` tagastab vabade seadmete arvu ajavahemikus (näiteks 12 vaba 30-st). See pole kunagi negatiivne.

### Broneeringute muutuste ajalugu
- `booking_changes`: iga broneeringu loomine, muutmine ja kustutamine salvestub automaatselt (päästik tabelil `bookings`): kes (`changed_by`), millal (`changed_at`), toiming (`created`, `updated`, `deleted`) ning andmed enne ja pärast (`old_data`, `new_data`).
- Ajalugu säilib ka pärast broneeringu või terve sarja kustutamist.
- Muudatus, mis ei muuda ühtegi välja, ajalukku ei lähe.
- `changed_at` on tehingu algusaeg, nii et ühe hulgimuudatuse kõigil ridadel on sama aeg. Järjesta ajalugu `changed_at` ja seejärel `id` järgi.
- Ajalugu saab lugeda ainult admin. Keegi ei saa seda rakendusest lisada, muuta ega kustutada.

### Seadmete saadavus
- `device_availability(p_date, p_starts, p_ends)`: tagastab iga arhiveerimata seadme koguarvu ja vaba koguse antud ajavahemikus. Kuupäev ja kellaajad on Tallinna aja järgi, nii et suve- ja talveaja vahetus on arvestatud.
- Vaba kogus tuleb funktsioonist `available_quantity`, nii et seadmete valik ja `create_booking` arvestavad mahtu ühtemoodi (tipukasutus, poolavatud vahemikud, mitte alla 0).
- Funktsiooni saavad kutsuda ainult sisseloginud kasutajad.

### Näidisandmed
`supabase db reset` laeb pärast migratsioone faili `supabase/seed.sql`. Kõik väärtused on näidised ja need tuleb enne pilooti asendada kooli päris andmetega.
- Seadmed: Sülearvuti 30, Tahvelarvuti 20, LEGO WeDo 2.0 12, LEGO SPIKE 12, Ozobot 15, DJI Tello EDU 6, 3D-printer 1, Cricut 1. Kogused muutuvad pärast kooli inventuuri.
- Õppeaasta 2026-09-01 kuni 2027-06-05 ning vaheajad: sügisvaheaeg 2026-10-26 kuni 2026-11-01, jõuluvaheaeg 2026-12-23 kuni 2027-01-02, kevadvaheaeg 2027-03-22 kuni 2027-03-28.
- Koolitunnid 1–8: 08:15–09:00, 09:10–09:55, 10:05–10:50, 11:00–11:45, 12:15–13:00, 13:10–13:55, 14:05–14:50, 15:00–15:45.

## Rakendus

### Seadme ja koguse valik (avaleht)
- Õpetaja valib kuupäeva ja koolitunni (algus- ja lõpuaeg täituvad ise) või sisestab algus- ja lõpuaja vabalt.
- Seadmete valikus on iga seadme juures vaba ja kogu kogus valitud ajal, näiteks "Sülearvuti – 12 / 30 vaba". Arhiveeritud seadmeid valikus ei ole.
- Üksikobjekti (koguarv 1, näiteks 3D-printer) puhul koguse välja ei näidata.
- Kui soovitud kogus on suurem kui vaba kogus, näidatakse hoiatust. Broneeringu salvestamine tuleb issue'ga #11.
- Saadavus arvutatakse iga päringu ajal uuesti ega tule vahemälust.
