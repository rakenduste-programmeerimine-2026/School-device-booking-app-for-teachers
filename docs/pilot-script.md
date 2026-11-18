# Piloodi testistsenaarium kontaktisikuga

Eesmärk: kontaktisik teeb terve aasta broneeringu umbes kahe minutiga ja rakenduses on päris andmed. Testi viib läbi meeskonna liige (vaatleja), kontaktisik kasutab rakendust ise. Vaatleja ei aita, kui kontaktisik ei küsi; segadused kirjutatakse üles.

Aadress: https://school-device-booking-app.vercel.app

## 1. Ettevalmistus (admin, enne kohtumist)

Kõik need tehakse lehel `/haldus` (kontaktisik lisatakse lubatud e-postide nimekirja rolliga õpetaja).

- [ ] Rakenduse nimi asendatud päris nimega (`frontend/app/layout.tsx` ja sisselogimisleht)
- [ ] Seadmete kogused asendatud kooli inventuuri tulemustega
- [ ] Õppeaasta algus ja lõpp sisestatud
- [ ] Vaheajad, riigipühad ja õppetöövabad päevad sisestatud
- [ ] Koolitundide kellaajad sisestatud
- [ ] Kontaktisiku e-post on lubatud nimekirjas
- [ ] Katsebroneeringud on kustutatud, nii et kontaktisik alustab puhtalt lehelt
- [ ] Stopper ja märkmepaber (või see fail) valmis

## 2. Sissejuhatus (1 min)

Ütle kontaktisikule: "Me testime rakendust, mitte sind. Mõtle valjusti. Kui miski on segane, ütle seda." Ära näita ette, kuidas rakendus töötab.

## 3. Ülesanded

Iga ülesande ajal käivita stopper, kui kontaktisik hakkab klõpsama, ja peata, kui ta ütleb "valmis". Pane aeg ja märkused tabelisse allpool.

| # | Ülesanne | Eesmärk |
|---|----------|---------|
| 1 | Logi Google'iga sisse. | Sisselogimine töötab |
| 2 | **Põhiülesanne.** Broneeri terveks õppeaastaks tavaline seade, mida ta päriselt kasutab (näiteks 15 sülearvutit), kahel nädalapäeval, samal tunnil, kogu õppeaasta. | **Kuni 2 min** |
| 3 | Kui eelvaates on konflikt, lahenda see (vähenda kogust, jäta kuupäev vahele või vali muu aeg). | Konfliktid on arusaadavad |
| 4 | Kontrolli, et vaheajad ja pühad on sarjast välja jäetud. | Kuupäevad õiged |
| 5 | Muuda ühe nädala broneeringu kogust. | Üksiku broneeringu muutmine |
| 6 | Kustuta kõik broneeringud alates valitud kuupäevast. | "See ja kõik järgnevad" |
| 7 | Vaata ülevaatelehelt, kes mida millal broneeris. | Ülevaade |

## 4. Tulemuste tabel

Kuupäev: ____________  Kontaktisik: ____________  Vaatleja: ____________

| # | Aeg (min:s) | Õnnestus ilma abita? (jah/ei) | Märkused, segadused, vead |
|---|-------------|-------------------------------|---------------------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

Ülesande 2 aeg on kirja pandud: ____ min ____ s. Eesmärk (2 min või vähem) täidetud: jah / ei.

## 5. Lõpuküsimused (2 min)

1. Mis oli kõige segasem hetk?
2. Kas midagi puudus, mida sa ootasid?
3. Kas kasutaksid seda Stuudiumi asemel? Miks või miks mitte?

## 6. Pärast testi

- [ ] Iga leitud probleem on kirjutatud eraldi GitHubi issue'ks (mis juhtus, mida oodati, mitu korda, kui tõsine)
- [ ] Põhiülesande aeg on kirjutatud issue #24 kommentaari
- [ ] Katsebroneeringud on kustutatud, kui kontaktisik neid ei jäta
