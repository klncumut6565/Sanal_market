# Kategorisiz ürünleri addan kategoriye dağıtan kural seti (2026-10-15 kullanıldı).
# Kullanım: python3 scripts/kategori_dagit.py urunler.json atama.json kalan.txt  (urunler.json = [[id, ad], ...])
# Sıra önemli: önce dondurma ve kasa önü, sonra bilinen atıştırmalık marka/türleri, en son genel kelimeler.
import json,re,collections,sys
rows=json.load(open(sys.argv[1]))
def f(s):
    s=s.replace('İ','I').replace('ı','i').lower()
    for a,b in zip('çğöşüâîû','cgosuaiu'): s=s.replace(a,b)
    return ' '+re.sub(r'[^a-z0-9]+',' ',s).strip()+' '
# Sıra önemli: ilk eşleşen kazanır
R=[('Dondurma', ' magnum | cornetto | algida | max (?!dish)| carte d or | dondurma | kulahli | buzi | panda | maras | golf || twister | fruttini | solero | nogger | ice cream | eskimo || sundae '), ('Gıda Dışı / Kasa Önü Ürünleri', ' cakmak | clipper | cliper | clipperr | cricket | bic | diblong | dilbong | dlblong | fener | bjk | cimbom | gs | ts | bayrak | atki | duracel |  pil | duracell | energizer | panasonic | ampul | kibrit | kart | sarj | kablo | kulaklik | jilet | prezervatif | durex | okey | kondom | maske | semsiye | oyuncak | balon | top | yapistirici | bant | kalem | defter | sinek | mum | kolonya cikmaz '), ('Atıştırmalık', ' cips | chips | fisti | kremali | classics | areka | candy | maltana | laviva | nesfit |  biskuvi | kraker | gofret | cikolat | sakiz | jelibon | lokum | draje | wafer | popcorn | patlamis | kuruyemis | findik ici | kaju | cerez | cerezza | cerezos | eti | etibrovni | etikremali | ulker | tadim | tadimca | mentos | vivident | vivdent | olips | first | haribo | fresa | lays | doritos | doritoz | ruffles | cheetos | pringles | patos | cipso | master potato | chips master | gong | biscolata | dankek | tofita | rocco | missbon | kinder | halley | luppo | ozmo | benimo | saklikoy | fistixx | falim | big babol | babol | bubblicious | chupa | toblerone | toffifee | tadelle | m m | crax | biskrem | popkek | topkek | negro | hosbes | burcak | metro | albeni | probis | kitkat | snickers | twix | oreo | nutymax | gofrik | jacops | jacobs (?=.*(biskuvi|kraker))| hanimeller | sarelle bar | nestle (?=.*(bar|cikolat|damak|crunch))| damak | crunch | brown | crepe | canpare | pismaniye | beyoglu | alpella | tipitip | toybox | yuppo | kekstra | janim | lifalif | lilalif | manu | miskets | mokibon | mr beast | paykek | polo | link | stag | '), ('Meze/Hazır Yemek', ' tost | burger | kumru | patates | sogan halkasi | borani | sosisli | kofte ekmek | ciger | cigkofte | durum | salata | amerikan | rus salata | humus | haydari | acili ezme | meze | sarma | dolma | hazir yemek | konserve | turşu | tursu | mantar konserve | bezelye konserve | fasulye konserve | noodle | indomie | hazir corba | erisme | kup corba | pizza | lahmacun | tost '), ('İçecek', ' bubble | schewep | obsesso | pinar (?=.*[0-9]+ ?ml)| buz | capri | shot | buzzer | buzer | enjoy | energy | gazozu | aroma | cool | frutti | basil |cola | coca | pepsi | fanta | sprite | 7up | yedigun | schweppes | gazoz | soda | maden suyu | sirma | beypazari | uludag | erikli | hayat su | pinar su | nestle su | su | ayran | kefir | meyve suyu | cappy | dimes | tamek | tropicana | juice | nektar | icetea | ice tea | fuse | lipton ice | red ?bull | redbull | monster | burn | power ?horse | hell | xl | nitro | enerji | limonata | sira | salgam | boza | kahve (?=.*(soguk|latte|cold|ice)) | starbucks | nescafe xpress | ice coffee | iced | mojito | churchill | portakal suyu | dogadan ice | caykur ice '), ('Gıda / Temel Tüketim Maddeleri', ' cay | caykur | dogus | lipton | dogadan | kahve | nescafe | jacobs | jacops | tchibo | kurukahveci | mehmet efendi | nesquik | sahlep | sicak cikolata | kakao | bitki cayi | ihlamur | salep '), ('Temizlik', ' febreze | oda kokusu | deterjan | bulasik | camasir | yumusatici | cif | domestos | ace | vim | fairy | pril | finish | ariel | omo | persil | bingo | tursil | yuzey temizleyici | cam sil | camasir suyu | sunger | eldiven | kir | cif | harpic '), ('Kişisel Bakım', ' clear | sampuan | sac | dus jeli | sabun | dis macunu | dis fircasi | deodorant | deo | parfum | kolonya | krem | losyon | tras | gillette | nivea | rexona | axe | dove | head shoulders | elidor | colgate | signal | ipana | sensodyne | pamuk | ped | orkid | hijyenik | ruj | oje | tirnak '), ('Kağıt Havlu ve Hijyen Ürünleri', ' tuvalet kagidi | kagit havlu | pecete | mendil | islak | selpak | solo | familia | bebek bezi | prima | molfix | papia | cop torbasi | cop poseti | strec | aluminyum folyo '), ('Evcil Hayvan Ürünleri', ' kedi | kopek | mama | whiskas | felix | pedigree | proplan | reflex | kum '), ('Süt Ürünleri & Kahvaltılık ve Şarküteri', ' sut | yogurt | peynir | kasar | beyaz peynir | tulum | lor | labne | krema | tereyag | margarin | yumurta | zeytin | recel | bal | pekmez | tahin | helva | nutella | sarelle | findik ezmesi | fistik ezmesi | kahvaltilik | icim | pinar (?!su)| sek | danone | activia | torku sut | eker | president | muratbey | tahsildaroglu | sucuk | salam | sosis | pastirma | jambon | kavurma | lukanka | fume | hindi | dana jambon | cokokrem | cokomel | puding | sutlac | kazandibi | milk '), ('Et, Tavuk & Balık', ' kiyma | kusbasi | biftek | antrikot | pirzola | kofte | tavuk | but | kanat | gogus | pilic | balik | ton baligi | hamsi | levrek | cipura | somon | et '), ('Fırından', ' ekmek | lavas | tortilla | simit | pogaca | borek | sandvic ekmegi | hamburger ekmegi | bazlama | yufka | pide | galeta | grissini '), ('Temel Gıda', ' ton | dardanel | makarna | spagetti | eriste | pirinc | bulgur | un | seker | toz seker | kup seker | tuz | yag | aycicek | zeytinyagi | misir yagi | salca | ketcap | mayonez | hardal | sos | baharat | pul biber | karabiber | kimyon | nane | mercimek | nohut | fasulye | barbunya | irmik | nisasta | maya | kabartma | vanilya | corba | sirke | limon sosu '), ('Meyve & Sebze', ' domates | biber | patates | sogan | sarimsak | elma | portakal | mandalina | muz | limon | salatalik | marul | maydanoz | dereotu | havuc | patlican | kabak | uzum | cilek | karpuz | kavun | armut | nar | kivi '), ('Atıştırmalık', ' pismaniye | brown | crepe | canpare | crunch | chips | babol | bubblicious | bovnty | etibrovni | etikremali | classics | antep | ferhan | karisik | dubai | beyoglu | alpella | ozel karisik | eti | ulker | tadim | cipso | patos | lays | doritos | ruffles | cheetos | pringles | cerezza | cerez | cerezos | olips | first | vivident | mentos | haribo | fresa | biscolata | luppo | dankek | kinder | kitkat | snickers | twix | mars | bounty | oreo | biskrem | popkek | halley | dido | albeni | metro | probis | cizi | coco ?star | crax | fistixx | badem | findik | fistik | kaju | leblebi | ceviz | kuruyemis | cikolata | gofret | biskuvi | kraker | kek | sakiz | seker | lokum | lolipop | chupa | missbon | tofita | jelibon | golf | falim | bubble | big babol | vegas | saklikoy | tadimca | nutymax | gofrik | toskow | toscow | godiva | rocco | wafer | cips | pop | patlamis misir | misir | crispy | bar | protein | ozmo | benimo | hanimeller | gong | pastil | sarelle | damak | mabel | nestle | milka | torku | cokoprens | pozitif | tutku | canga | negro | petito | hosbes | burcak | karam | kat kat | today | rulokat | caramio | cokonat | pirpirim | maltana | rulo ')]
cnt=collections.Counter(); out=[]; left=[]
EXACT={'et','su','un','but','bar','pop','top','pil','ace','bal','sek','sos','yag','tuz','deo','sac','kum','nar','ped','mum','kir','max','xl','cay','sut','kek','bant','buz','sut'}
def compile_rx(rx):
    parts=[p.strip() for p in rx.split('|')]
    out=[]
    for p in parts:
        if not p: continue
        if ' ' in p or '(' in p or '?' in p or p in EXACT or len(p)<4: out.append(' '+p+' ')
        else: out.append(' '+p)
    return '|'.join(out)
R=[(c,compile_rx(rx)) for c,rx in R]
for id_,name in rows:
    n=f(name); cat=None
    for c,rx in R:
        if re.search(rx,n): cat=c; break
    if cat: out.append((id_,name,cat)); cnt[cat]+=1
    else: left.append(name)
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
for k,v in cnt.most_common(): print(f"{v:5} {k}")
print(f"{len(left):5} SINIFLANDIRILAMADI")
open(sys.argv[3],'w').write('\n'.join(left))

# ---- elle eşleme (kalanlar) ----
M={
"Atıştırmalık":"BOOM GOLD;CARTE DOR CHOCOLATİER;DORİTOZ KÜÇÜK;DORİTOZ KÜÇÜK ACILI;GAMER CANDY;HİLTİ ÇİKOLTA;JANIM KIRMIZI MEYVELER;JANIM SARI MEYVELER;KEKSTRA JÖLEBOL;KRUVASAN;KRUVASAN 7 DAYS;LAVİVA SELECTİON;LİFALİF LURU MEYVELİ;LİLALİF KURU YEMİŞLİ;M&M;S;M&M;S CHOCOLATE;MANU SUSAM KROKAN;MASTER POTATO;MASTER POTATO ACI;MASTER POTATO ORIGINAL;MİNT;MISKETS CHİCKEN BİTE;MOKİBON BURGER;MR BEAST FEASTABLES;PAYKEK;POLO SPERMINT;TADELLE BEYAZ 30 GR;TADELLE BEYAZ KÜÇÜK;TADELLE BÜYÜK;TADELLE KING SIZE;TADELLE KIRMIZI KÜÇÜK;TİPİTİP;TOBLERONE;TOFFİFEE;TOPKEK MEYVELİ;TOYBOX DRAJEBON;ULTRA PEANLIT;VIVDENT AHUDUDU;YER FISTIĞI İŞLENMİŞ;YUPPO ÇOKO JELO BÖĞÜRTLEN;KARLAR ÜLKESİ;ŞEKLİ ŞAHANE;LİNK;LİNK VİŞNE;STAG;ZEN;MENTÖL",
"İçecek":"FRİGOLA;INTERGALACTİC ZERO SUGAR;LAİMON FRESH 250 ML;LAİMONFRESH 330 ML;MEYSU KAYISI 1LT;MEYSU ŞEFTALİ 1LT;PINAR AÇ BİTİR;PINAR MACAR AÇ BİTİR;PINAR MUZLU 200ML;POWERADE MAVİ;POWERADE TURUNCU 500 ML;RAMAZAN ŞERBETİ;REDBUL ZERO;REDD BULL MAVİ;SERENE ANANAS PARÇACIKLI 250 ML;SERENE MANGO PARÇACIKLI 250 ML;SERENE ŞEFTALİ PARÇACIKLI 250 ML;OBSESSO COCONUT LATTE;OBSSEZO;HİGB POWER;ULTRA PÜRE;MEDLEY BLUE;MEDLEY WHİTE",
"Gıda / Temel Tüketim Maddeleri":"CAFE CROWN 3/1 ARADA;NESCASFE 3/1 ARADA SÜTLÜ KÖPÜKLÜ;NESFİTTT",
"Dondurma":"CORMETTO DOĞRUŞUK CESARETLİK",
"Gıda Dışı / Kasa Önü Ürünleri":"IŞIKLI ÇKMAK;KARI ÇAKMAGI;MUHTAR ÇAKMAGI GAZLI RÜZGAR;KOKO PLASTİK RÜZGAR;X-LİTE LİGHTER FLUİD;HÜNKAR 4 LÜ TABAK;ÖZTUNA 2Lİ TABAK;GERGEDAN +18;KAMARGRA;HİLTİ TABLET 2 ADET;ZİROLL BİTKİSEL KARIŞIMLI MACUN;SİGARA MENTHOL;SİGARA MENTHOL & BÖĞÜRTLEN;SİGARA MENTHOL TOPLARI;SİGARA MENTOL 20 ADET;SİGARA MENTOL TÜM ÇEŞİTLER;SM 143P;SM-117T;BİDOLU KÜÇÜK;BABILMAGİÇ KUBE;RODEO;KANKY;GORALI;PIRO KAKASI",
"Kişisel Bakım":"LOREAL ELSEVE PARİS;SECRET SÜPER WAX;SİNKOV SPREY",
"Kağıt Havlu ve Hijyen Ürünleri":"KOTEX ULTRA GECE;SANTAVİK YARABANDI;YARA BANDI KUTU",
}
mm={}
for c,v in M.items():
    for n in v.replace('M&M;S','M&M\x00S').split(';'): mm[n.replace('\x00',';').strip()]=c
done={a[0] for a in out}
add=0
for id_,name in rows:
    if id_ in done: continue
    if name in mm: out.append((id_,name,mm[name])); add+=1
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
rest=[n for i,n in rows if i not in {a[0] for a in out}]
print("elle eklenen",add,"kalan",len(rest),rest)
