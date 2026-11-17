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
- `allowed_emails`: ainult siin olevate e-postidega saab sisse logida. Admin saab e-posti lugeda, lisada (rolliga õpetaja või admin) ja eemaldada; õpetaja ei näe tabelit ega saa seda muuta. Rolli ega aadressi muuta ei saa: eemalda ja lisa uuesti.
- Admini õigus tuleb nimekirjast: `is_admin()` kontrollib `allowed_emails` rolli, mitte ainult `profiles.role`. Eemaldatud või õpetajaks muudetud admin kaotab õigused kohe, ka kehtiva pääsutõendi ajal, ega saa end uuesti lisada. Lisamisel seatakse ka `profiles.role` nimekirja rolli järgi.
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

### Sarja eelvaade
- `preview_series(device_type_id, dates)` näitab enne kinnitamist iga kuupäeva vaba kogust ja konflikte. Ta ei kirjuta ühtegi rida.
- `dates` on JSON-massiiv `[{ "starts_at", "ends_at", "quantity" }]`: kuupäevad tulevad funktsioonist `generateSeriesDates` ja igal kuupäeval on oma kogus, et õpetaja saaks konflikti korral ühe kuupäeva kogust vähendada. Sarja kinnitamine (#15) võtab sama sisendi.
- Iga kuupäeva kohta tagastatakse `date_position` (järjekorranumber sisendis, alates 1), `starts_at`, `ends_at`, `quantity`, `free_quantity` (mitte alla 0) ja `has_conflict` (kui soovitud kogus on suurem kui vaba).
- Vaba kogus arvutatakse samamoodi nagu `create_booking` puhul (tipukasutus, poolavatud vahemikud).
- Vead: `not_authenticated`, `access_revoked`, `device_type_not_found`, `device_type_archived`, `invalid_dates` (sisend pole massiiv või on üle 1000 kuupäeva), `invalid_quantity`, `invalid_range` ja `overlapping_dates` (kaks sama sarja kuupäeva kattuvad; suurema vajaduse korral suurenda kogust).
- Vigane väärtus (näiteks kogus "abc" või vale kuupäev) annab koodiga vea `invalid_quantity` või `invalid_range`, mitte andmebaasi teisendusviga.
- Terve õppeaasta (158 kuupäeva) eelvaade võtab kohalikult umbes 30 ms, maksimaalne 1000 kuupäeva umbes 0,2 s.

### Sarja kinnitamine
- `commit_series(device_type_id, dates)` salvestab sarja: kas kõik kuupäevad või mitte ühtegi. Sisend on sama nagu `preview_series` puhul. Edu korral tagastatakse sarja id; sari kuulub kinnitajale ja igal kuupäeval on oma broneering.
- Funktsioon lukustab seadme rea (`FOR UPDATE`) ja kontrollib iga kuupäeva uuesti, sest saadavus võib pärast eelvaadet muutuda.
- Kui mõnel kuupäeval pole piisavalt vaba, tagastatakse viga `insufficient_capacity` ja ühtegi rida ei kirjutata. Vea detailis on konfliktid JSON-ina: `[{"date_position": 2, "free_quantity": 3}]`.
- Muud vead on samad mis eelvaatel, lisaks `invalid_dates` tühja nimekirja korral. Sisendi reeglid on eelvaatega ühised (`check_series_dates`).

### Broneeringute muutmine ja kustutamine
- `delete_bookings(booking_id, scope, booking_ids)` kustutab ja `update_bookings(booking_id, scope, booking_ids, quantity, starts_time, ends_time)` muudab broneeringuid. Mõlemad tagastavad muudetud ridade arvu ja kasutavad sama valikuloogikat (`bookings_in_scope`).
- `booking_id` on broneering, millel kasutaja klõpsas. `scope` on:
  - `one`: ainult see broneering
  - `following`: see ja kõik järgmised sama sarja broneeringud
  - `series`: terve sari
  - `selected`: `booking_ids` loetelu, kõik samast sarjast
- Sarja ulatusega muudatused (`following`, `series`, `selected`) puudutavad ainult tulevasi broneeringuid; möödunud jäävad ajaloona alles. Ühte möödunud broneeringut (`one`) saab parandada või kustutada ainult admin.
- Õpetaja muudab ainult enda broneeringuid, admin kõiki.
- `update_bookings`: tühi väärtus jätab vana alles. Uus algus- ja lõpuaeg on Tallinna kellaaeg iga broneeringu enda kuupäeval, nii et terve sarja teise tundi tõstmine on õige ka suve- ja talveaja vahetusel. Mahtu kontrollitakse uuesti; kui mõni kuupäev ei mahu, tagastatakse `insufficient_capacity` (detailis `[{"booking_id", "free_quantity"}]`) ja midagi ei muudeta.
- Kui sarjast ei jää ühtegi broneeringut, kustutatakse ka sari. Ajalugu säilib.
- Vead: `not_authenticated`, `access_revoked`, `booking_not_found`, `not_allowed`, `booking_in_past`, `invalid_scope`, `invalid_selection`, `no_bookings`, `nothing_to_change`, `invalid_quantity`, `invalid_range`, `insufficient_capacity`.
- Serveritoimingud `updateBookings` ja `deleteBookings` (`frontend/app/broneeringud/actions.ts`) kontrollivad kasutajat `getClaims()`-iga, kutsuvad ülaltoodud funktsioone ja tõlgivad vead eestikeelseks teateks. Mahu puudumisel tagastab `updateBookings` konfliktide loetelu (`conflicts`) ja midagi ei muudeta. Kasutajaliides on lehel `/broneeringud/minu` (vt "Minu broneeringud").

### Ühe broneeringu tegemine (leht `/broneeringud/uus`)
- Õpetaja valib seadme, koguse (ühe tükina seadme puhul, nt 3D-printer, välja ei näidata), kuupäeva ning kas koolitunni või vabad algus- ja lõppajad. Koolitunni valikul salvestatakse tunni algus- ja lõpuaeg.
- Serveritoiming `createBooking` (`frontend/app/broneeringud/actions.ts`) kutsub `create_booking`. Kellaajad tõlgitakse Tallinna kohaliku ajana (`frontend/lib/tallinn-time.ts`), nii et suve- ja talveaeg on õige.
- Vigade korral näidatakse eestikeelset teadet, nt „Valitud ajal on vabu seadmeid ainult 5.“ Koolivaheajale võib üksikbroneeringu teha.

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
- Vaba kogus uueneb ise: leht tellib Supabase Realtime'i kaudu tabeli `bookings` muudatused (Postgres Changes) ja iga sündmuse peale arvutab server saadavuse uuesti. Kui keegi teine broneerib samal ajal, muutub "X / Y vaba" ilma lehte värskendamata. Sündmuse sisu ei kasutata, numbrid tulevad alati serverist.
- Selleks on tabel `bookings` lisatud publikatsiooni `supabase_realtime`. Realtime saadab sündmusi ainult sisseloginud kasutajatele, kellel on õigus broneeringuid lugeda.

### Sarja kuupäevad
- `generateSeriesDates` (`frontend/lib/series-dates.ts`) annab õppeaasta kõik valitud nädalapäevade kuupäevad koos algus- ja lõpuajaga (UTC ISO). Kuupäevi käiakse läbi kalendripäevadena ja kellaaeg tehakse Tallinna aja järgi, seega suve- ja talveajale üleminek ei nihuta tunde.
- Vaheajad, riigipühad ja õppetöövabad päevad (piirid kaasa arvatud) jäetakse välja, välja arvatud kuupäevad, mille õpetaja jätab `keepDates` kaudu sarja alles.
- Funktsioon ei loe andmebaasi: õppeaasta ja perioodid antakse sisse. Seda kasutab korduva broneeringu vorm.

### Korduv broneering (leht `/broneeringud/sari`)
- Avalehelt link "Korduv broneering". Õpetaja valib seadme ja koguse (ühe tükina seadme puhul koguse välja ei näidata) ning ühe või mitu rida "nädalapäev + aeg". Aeg on koolitund (algus ja lõpp täituvad ise) või vabalt sisestatud algus- ja lõpuaeg. Sama nädalapäeva võib lisada mitu korda, näiteks esmaspäeval 2. ja 5. tund.
- Periood on vaikimisi õppeaasta lõpuni: algus on tänane päev (või õppeaasta algus, kui see on hiljem), lõpp õppeaasta viimane päev. Mõlemat saab muuta õppeaasta piires.
- Õppetöövabad ajad jäetakse vaikimisi vahele. Iga perioodi (vaheaeg, püha, õppetöövaba päev) saab linnukesega sarja alles jätta.
- "Näita eelvaadet" kutsub `preview_series` ja näitab iga kuupäeva aega, kogust ja vaba kogust. Konfliktiga read on punased ja seni sarja kinnitada ei saa.
- Iga konfliktiga rea juures saab konflikti lahendada: muuta selle kuupäeva kogust (ühe tükina seadme puhul koguse välja pole), valida teise koolitunni või sisestada uue algus- ja lõpuaja (kuupäev jääb samaks) või vajutada "Jäta vahele", mis eemaldab kuupäeva sarjast. Kogus ja kellaajad rakenduvad, kui väljalt lahkuda. Iga muudatuse järel kontrollitakse vabu seadmeid kohe uuesti. Kui uus aeg ei sobi (näiteks kattub sarja teise ajaga), näidatakse viga ja eelvaade jääb endiseks.
- "Kinnita sari" kutsub `commit_series` täpselt nende kuupäevadega, mis olid viimases eelvaates, ja on lubatud alles siis, kui konflikte pole. Iga muudatus vormi ülaosas kustutab eelvaate. Kui keegi broneeris vahepeal, ei salvestata midagi ja eelvaates märgitakse uued konfliktid, mida saab samamoodi lahendada.
- Serveritoimingud `previewSeries` ja `commitSeries` on failis `frontend/app/broneeringud/actions.ts`. Õppeaasta, perioodid, seadmed ja tunnid loetakse iga päringu ajal.

### Broneeringute ülevaade (leht `/broneeringud`)
- Näitab ühe nädala (esmaspäevast pühapäevani) kõigi õpetajate broneeringuid. Iga rea juures on kellaaeg (Tallinna aja järgi), seade, kogus ja broneerija nimi (vaatest `profile_names`, teiste e-posti ega rolli ei näidata).
- Nädalat vahetatakse linkidega "Eelmine nädal" ja "Järgmine nädal" või aadressiga `/broneeringud?week=2026-11-16` (mistahes kuupäev, näidatakse selle nädalat). Vaikimisi on praegune nädal.
- Iga päev on nähtav ka siis, kui broneeringuid pole. Õppetöövabad päevad on eraldi värviga märgitud: koolivaheaeg (kollane), riigipüha (punane), õppetöövaba päev (sinine), koos perioodi nimega.
- Vaade on ainult lugemiseks: muutmise ja kustutamise nuppe pole ning kliendid ei saa tabelisse `bookings` otse kirjutada.
- Andmed loetakse iga päringu ajal uuesti ega tule vahemälust.

### Minu broneeringud (leht `/broneeringud/minu`)
- Avalehelt link "Minu broneeringud". Õpetaja näeb oma broneeringuid sarjade kaupa (üksikbroneering on ühe kuupäevaga sari). Iga sarja kokkuvõttes on seade, esimene ja viimane kuupäev ning tulevaste ja kõigi broneeringute arv; sarja avamisel on näha kõik kuupäevad.
- Admin näeb kõigi õpetajate sarju koos broneerija nimega ja saab neid muuta.
- Tuleva broneeringu juures "Muuda" avab paneeli, kus valitakse ulatus: ainult see broneering, see ja kõik järgmised, terve sari (ainult tulevased) või valitud kuupäevad (kui linnukesega on midagi valitud). Nupp "Muuda või kustuta valitud" avab sama paneeli valitud kuupäevadega.
- Muutmisel saab anda uue koguse (ühe tükina seadme puhul koguse välja pole) ja/või uue aja (koolitund või vaba algus- ja lõpuaeg). Tühi väli jätab vana väärtuse. Kui mõnel kuupäeval pole piisavalt vabu seadmeid, ei muudeta midagi ja nende kuupäevade juures näidatakse vaba kogust.
- Kustutamine küsib enne kinnitust koos kustutatavate broneeringute arvuga.
- Möödunud broneeringud on hallid ja neid ei saa valida. Ainult admin näeb nende juures nuppu "Paranda", mis muudab või kustutab ainult selle ühe broneeringu; muudatus jääb ajalukku. Õpetajale seda valikut ei kuvata.
- Leht uueneb ise, kui broneeringud muutuvad (Realtime), ja andmed loetakse iga päringu ajal uuesti. Broneeringud loetakse 1000 kaupa, nii et suur nimekiri ei lõigu ära.

### Haldus (leht `/haldus`)
- Avalehel on adminile link "Haldus". Tavaõpetaja suunatakse avalehele ja tema päringud tabelitele lükkab tagasi RLS.
- Seadmed: admin lisab seadme (nimi, kogus), muudab nime ja kogust ning arhiveerib või taastab seadme. Lehelt seadet ei kustutata, vanad broneeringud säilivad.
- Lubatud e-postid: admin lisab e-posti koos rolliga ja eemaldab selle. Eemaldatud kasutaja blokeeritakse (vt "Ligipääs ja lubatud e-postid"). Viimase admini eemaldamine annab veateate.
- Õppeaasta ja õppetöövabad ajad: admin muudab õppeaasta algus- ja lõppkuupäeva ning lisab uue õppeaasta. Iga õppeaasta all saab lisada, muuta ja kustutada koolivaheaegu, riigipühi ja õppetöövabu päevi (liik, nimi, algus- ja lõppkuupäev, mõlemad kaasa arvatud). Kattuva õppeaasta või vale kuupäevade järjekorra korral näidatakse veateadet.
- Õppeaastat lehelt ei kustutata, sest see kustutaks ka kõik selle perioodid. Toiming `deleteSchoolYear` on olemas, aga lehel nuppu pole.
- Koolitunnid: admin muudab tunni numbrit, algus- ja lõpuaega, lisab ja kustutab tunde. Muudatus mõjutab ainult seda, mis kellaajad tunni valimisel täituvad; olemasolevad broneeringud ei muutu.
- Serveritoimingud: `addSchoolYear`, `updateSchoolYear`, `addNonTeachingPeriod`, `updateNonTeachingPeriod`, `deleteNonTeachingPeriod` (liik `break`, `public_holiday` või `day_off`), `addLessonPeriod`, `updateLessonPeriod`, `deleteLessonPeriod`.
- Serveritoimingud on failis `frontend/app/haldus/actions.ts`; veateated tulevad aadressi parameetriga `?error=`.

### Muudatuste ajalugu (leht `/haldus/ajalugu`)
- Halduse lehel on link "Broneeringute muudatuste ajalugu". Leht näitab tabelist `booking_changes` iga muudatuse aega (Tallinna aja järgi), tegijat (nimi ja e-post), toimingut (Lisatud, Muudetud, Kustutatud), broneeringu ja sarja numbrit ning broneeringu andmeid enne ja pärast (seade, kuupäev, kellaaeg, kogus).
- Kustutatud broneeringute ja sarjade ajalugu on samuti nähtav. Arhiveeritud seadmete nimed kuvatakse ka.
- Uusimad muudatused on eespool, 100 rida lehel; link "Vanemad muudatused" näitab järgmised (`?before=<id>`).
- Tavaõpetaja suunatakse avalehele ja RLS ei lase tal ajalugu lugeda.
- Andmed loetakse iga päringu ajal uuesti ega tule vahemälust.

## Vercel preview
Kohalik arendus kasutab edasi `supabase start`. Vercel'i preview vajab internetist kättesaadavat Supabase'i, selleks on **eraldi hostitud Supabase'i projekt, mis on ainult preview jaoks**.

Seadistab inimene (saladusi ei commit'ita):
1. Loo Supabase'i projekt oma isikliku Supabase'i kontoga. Ära kasuta Supabase'i GitHub-integratsiooni ega Vercel-Supabase turuplatsi integratsiooni, need puudutavad organisatsiooni ja teisi repo'sid.
2. Pane migratsioonid projekti (hoolikalt, see on mitte-kohalik andmebaas): `supabase link --project-ref <ref>` ja `supabase db push`. Lisa `allowed_emails` tabelisse vähemalt üks admini e-post.
3. Supabase'i Authentication > Providers > Google: sisesta Google'i kliendi ID ja saladus. Authentication > URL Configuration: lisa Vercel'i preview aadress ja `<aadress>/auth/callback` lubatud ümbersuunamistesse. Google'i OAuth kliendile lisa Supabase'i callback `https://<ref>.supabase.co/auth/v1/callback`.
4. Vercel (omanik w1ttyrat): impordi repo. Juurkaust on `frontend`. Kui Hobby plaan ei luba organisatsiooni repot importida, vaja on Vercel'i tiimi või forki.
5. Vercel'i keskkonnamuutujad (Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ja `NEXT_PUBLIC_SITE_URL`. Viimane on rakenduse avalik aadress ilma lõpu kaldkriipsuta ja see sisse ehitatakse build'i ajal, seega kasuta püsivat aadressi (näiteks haru domeen), mitte iga deploy'i unikaalset linki.

Kontroll pärast deploy'd: logi Google'iga sisse, tee üksik- ja sarjabroneering, muuda ja kustuta broneeringuid, ava `/haldus` ja `/broneeringud`.

## Testid
Käivita repo juurkaustast, kui kohalik Supabase töötab (`supabase start`):
- `supabase test db`: pgTAP testid kaustas `supabase/tests` (mahutavus, poolavatud vahemikud, õigused ja RLS, ajalugu, ligipääsu äravõtmine).
- `bash supabase/tests/concurrency.sh`: kaks samaaegset andmebaasiühendust broneerivad sama seadet, kord üksikbroneeringuga ja kord sarja kinnitamisega. Test kinnitab, et teine päring ootab esimese lukku ja lükatakse tagasi, koguarvu ei ületata kunagi ja tagasi lükatud sarjast ei kirjutata ühtegi kuupäeva. Skript kirjutab ajutised read ja kustutab need ise.
- CI käivitab mõlemad igal PR-il.
- `npm test` kaustas `frontend`: Vitest testid (Tallinna aja teisendus ja sarja kuupäevad, sh suve-/talveajale üleminek ning õppetöövabade päevade vahelejätmine).
