# Piloodi testistsenaarium kontaktisikuga

Eesmärk: kontaktisik teeb terve aasta broneeringu umbes kahe minutiga ja rakenduses on päris andmed. Testi viib läbi meeskonna liige (vaatleja), kontaktisik kasutab rakendust ise. Vaatleja ei aita, kui kontaktisik ei küsi; segadused kirjutatakse üles.

Aadress: https://school-device-booking-app.vercel.app

## 1. Ettevalmistus (admin, enne kohtumist)

Enamik neist tehakse lehel `/haldus` (kontaktisik lisatakse lubatud e-postide nimekirja rolliga õpetaja). Rakenduse nime vahetus on koodimuudatus ja vajab eraldi PR-i enne pilooti.

- [ ] Rakenduse nimi asendatud päris nimega (koodimuudatus: `frontend/app/layout.tsx` ja sisselogimisleht, eraldi PR)
- [ ] Seadmete kogused asendatud kooli inventuuri tulemustega
- [ ] Õppeaasta algus ja lõpp sisestatud
- [ ] Vaheajad, riigipühad ja õppetöövabad päevad sisestatud
- [ ] Koolitundide kellaajad sisestatud
- [ ] Kontaktisiku e-post on lubatud nimekirjas
- [ ] Katsebroneeringud on kustutatud (lehel `/broneeringud/minu` või ülevaatelehel), nii et kontaktisik alustab puhtalt lehelt
- [ ] Konflikti ettevalmistus: admin broneerib valitud seadmest suurema osa ühele kuupäevale ja tunnile, mille kontaktisik valib (näiteks 20 sülearvutit 30-st esmaspäeval, 2. tund), et eelvaates oleks alati üks konflikt. Pärast testi see broneering kustutatakse
- [ ] Stopper ja märkmepaber (või see fail) valmis

## 2. Sissejuhatus (1 min)

Küsi enne rakenduse avamist ja kirjuta vastus üles: **Mis probleemi lootsid, et rakendus lahendab?** Seda vastust võrreldakse lõpus küsimustega 2 ja 6.

Ütle kontaktisikule: "Me testime rakendust, mitte sind. Mõtle valjusti. Kui miski on segane, ütle seda." Ära näita ette, kuidas rakendus töötab.

## 3. Ülesanded

Iga ülesande ajal käivita stopper, kui kontaktisik hakkab klõpsama, ja peata, kui ta ütleb "valmis". Pane aeg ja märkused tabelisse allpool.

| # | Ülesanne | Eesmärk |
|---|----------|---------|
| 1 | Logi Google'iga sisse. | Sisselogimine töötab |
| 2 | **Põhiülesanne.** Broneeri terveks õppeaastaks tavaline seade, mida ta päriselt kasutab (näiteks 15 sülearvutit), kahel nädalapäeval, samal tunnil, kogu õppeaasta. | **Kuni 2 min** |
| 3 | Eelvaates on ettevalmistatud konflikt: lahenda see (vähenda kogust, jäta kuupäev vahele või vali muu aeg). | Konfliktid on arusaadavad |
| 4 | Kontrolli, et vaheajad ja pühad on sarjast välja jäetud. | Kuupäevad õiged |
| 5 | Muuda ühe nädala broneeringu kogust. | Üksiku broneeringu muutmine |
| 6 | Kustuta kõik broneeringud alates valitud kuupäevast. | "See ja kõik järgnevad" |
| 7 | Vaata ülevaatelehelt, kes mida millal broneeris. Pärast ülesannet avab vaatleja adminina `/haldus/ajalugu` ja kontrollib, et kontaktisiku muudatused on seal. | Ülevaade ja muudatuste ajalugu |

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

## 5. Lõpuküsimused (kuni 5 min)

Kirjuta vastused üles sõna-sõnalt.

1. Kas said kokkulepitud ülesande tehtud? Kus vajasid abi?
2. Kas rakendus lahendab probleemi täielikult, osaliselt või veel mitte? Miks?
3. Kas kasutaksid seda päriselt? Miks või miks mitte?
4. Mis oli kõige kasulikum, segasem või puudu?
5. Kas seda tasub edasi arendada? Mida tuleks kõigepealt muuta?
6. Kui hästi vastas tulemus sellele, mida alguses kokku leppisime?

## 6. Pärast testi

- [ ] Iga leitud probleem on kirjutatud eraldi GitHubi issue'ks (mis juhtus, mida oodati, mitu korda, kui tõsine)
- [ ] Põhiülesande aeg on kirjutatud issue #24 kommentaari
- [ ] Katsebroneeringud on kustutatud, kui kontaktisik neid ei jäta
