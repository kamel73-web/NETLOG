-- À placer dans supabase/migrations/20261115_wilayas_69_et_tamazight.sql
-- Appliquée et vérifiée sur le STAGING le 15/11/2026. NON appliquée en production (sauvegarde requise).
-- Passage de 58 à 69 wilayas (réforme 2026) + colonnes Tamazight.
-- Les codes 1 à 58 ne changent pas. parent_code garde la wilaya d'origine des 11 nouvelles.
-- Les noms arabes des wilayas 59 à 69 sont à faire relire.

alter table public.wilayas  add column if not exists parent_code smallint references public.wilayas(code);
alter table public.wilayas  add column if not exists name_tzm text;
alter table public.communes add column if not exists name_tzm text;

insert into public.wilayas (code, name, name_ar, parent_code) values
 (59, 'Aflou',                    'آفلو',                 3),
 (60, 'Barika',                   'بريكة',                5),
 (61, 'El Kantara',               'القنطرة',              7),
 (62, 'Bir El Ater',              'بئر العاتر',           12),
 (63, 'El Aricha',                'العريشة',              13),
 (64, 'Ksar Chellala',            'قصر الشلالة',          14),
 (65, 'Aïn Ouessara',             'عين وسارة',            17),
 (66, 'Messaad',                  'مسعد',                 17),
 (67, 'Ksar El Boukhari',         'قصر البخاري',          26),
 (68, 'Bou Saâda',                'بوسعادة',              28),
 (69, 'El Abiodh Sidi Cheikh',    'الأبيض سيدي الشيخ',    32)
on conflict (code) do nothing;

-- Rattachement des 108 communes, avec contrôle strict de l'effectif attendu par wilaya.
do $$
declare
  r record;
  n int;
  total int;
begin
  for r in
    select * from (values
      (59, 3,  12, array['AFLOU','GUELTAT SIDI SAAD','AIN SIDI ALI','BEIDHA','BRIDA','EL GHICHA','HADJ MECHERI','SEBGAG','TAOUIALA','OUED MORRA','OUED M''ZI','SIDI BOUZID']),
      (60, 5,  8,  array['BARIKA','BITAM','AZIL ABDELKADER','TILATOU','SEGGANA','DJEZZAR','AMDOUKEL','OULED AMMAR']),
      (61, 7,  5,  array['EL KANTARA','AIN ZAATOUT','BRANIS','EL OUTAYA','DJEMORAH']),
      (62, 12, 4,  array['BIR EL ATER','NEGRINE','EL OGLA EL MALHA','FERKANE']),
      (63, 13, 4,  array['EL ARICHA','EL GOR','SIDI DJILLALI','EL BOUIHI']),
      (64, 14, 6,  array['KSAR CHELLALA','EL ZMALET EMIR AEK','RECHAIGA','HAMADIA','SERGHINE','BOUGARA']),
      (65, 17, 10, array['AIN OUSSERA','BIRINE','BOUIRA LAHDEB','EL KHEMIS','SIDI LAADJEL','HAD SAHARY','GUERNINI','BENHAR','HASSI FEDOUL','AIN FEKKA']),
      (66, 17, 8,  array['MESSAAD','SED RAHAL','FEIDH EL BOTMA','GUETTARA','SELMANA','OUM LADHAM','DELDOUL','AMOURAH']),
      (67, 26, 21, array['KSAR EL BOUKHARI','OULED MAAREF','AIN BOUCIF','DERRAG','BOUAICHE','KEF LAKHDAR','CHELLALET EL ADHAOURA','OULED HELLAL','TAFRAOUT','BOGHAR','SIDI DAMED','AZIZ','CHAHBOUNIA','CHENIGUEL','AIN OUKSIR','OUM EL DJALIL','MFATHA','BOUGHZOUL','EL OUINET','OULED ANTAR','SANEG']),
      (68, 28, 23, array['BOUSAADA','KHOUBANA','M''CIF','OULED SIDI BRAHIM','SIDI AMEUR','TAMSA','BEN SROUR','OULED SLIMANE','EL HOUAMED','EL HAMEL','ZARZOUR','MOHAMED BOUDIAF','BENZOUH','BIR FODDA','AIN FARES','SIDI M''HAMED','MENEA','AIN EL MELH','MEDJEDEL','SLIM','AIN ERRICH','OULTEN','DJEBEL MESSAAD']),
      (69, 32, 7,  array['EL ABIODH SIDI CHEIKH','AIN EL ORAK','ARBAOUET','BOUSSEMGHOUN','CHELLALA','EL BNOUD','EL MEHARA'])
    ) as t(new_code, origin_code, expected, names)
  loop
    update public.communes
       set wilaya_code = r.new_code
     where wilaya_code in (r.origin_code, r.new_code)
       and upper(replace(name, '’', '''')) = any (r.names);
    get diagnostics n = row_count;
    if n <> r.expected then
      raise exception 'Wilaya % : % communes rattachées, % attendues. Noms absents : %',
        r.new_code, n, r.expected,
        (select string_agg(x, ', ') from unnest(r.names) x
          where not exists (select 1 from public.communes c
                            where c.wilaya_code in (r.origin_code, r.new_code)
                              and upper(replace(c.name, '’', '''')) = x));
    end if;
  end loop;

  select count(*) into total from public.communes;
  if total <> 1541 then raise exception 'Total communes % au lieu de 1541', total; end if;
  select count(*) into total from public.communes where wilaya_code between 59 and 69;
  if total <> 108 then raise exception '% communes dans les wilayas 59-69 au lieu de 108', total; end if;
end $$;
