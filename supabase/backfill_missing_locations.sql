-- One-time data fix: backfills public.freelancer_profiles.locations for test
-- accounts that had an empty locations array, which blocks the Event
-- Matcher's location-coverage check (src/lib/eventMatcher.ts's
-- locationCovers) regardless of category/availability/budget fit — see
-- backfill_missing_skills_styles.sql for the same issue on skills/styles.
--
-- Each row's location is real-geocoded (via OpenStreetMap/Nominatim, the
-- same provider src/lib/osmGeocoding.ts already uses) from that
-- freelancer's own users.location text, not fabricated. One freelancer
-- ("Mary Jane") had no base location text at all; Bangkok — the most
-- common city already in this dataset — was used as a placeholder there.
--
-- Run this once against your Supabase project's SQL editor.

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bago Region, Myanmar', 'latitude', 18.2457067, 'longitude', 96.1004931, 'city', 'Bago Region', 'district', null, 'placeId', 'relation:5996474'))
where id = 'ab80e753-e684-48ff-ae8f-702564c46ffa' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Udon Thani Province, Thailand', 'latitude', 17.5211917, 'longitude', 102.6680012, 'city', null, 'district', null, 'placeId', 'relation:1908831'))
where id = '2165a335-f292-4ba6-acac-959df0b96e89' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Udon Thani Province, Thailand', 'latitude', 17.5211917, 'longitude', 102.6680012, 'city', null, 'district', null, 'placeId', 'relation:1908831'))
where id = '5fce91ac-b00e-4634-becf-f0f12aea83cf' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '7b441605-ff12-4491-9ee6-dcfe47feaec5' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chiang Mai City Municipality, Fa Ham, Mueang Chiang Mai District, Chiang Mai Province, Thailand', 'latitude', 18.7882778, 'longitude', 98.9858802, 'city', 'Chiang Mai City Municipality', 'district', 'Mueang Chiang Mai District', 'placeId', 'relation:18271830'))
where id = '9dafee94-f8e0-4f4e-81b6-0044de1dc2b1' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Samut Prakan Province, Thailand', 'latitude', 13.6531651, 'longitude', 100.8182578, 'city', null, 'district', null, 'placeId', 'relation:1908815'))
where id = 'f8469381-5e6d-4ff9-a654-2fd6ce2633d8' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = '8780643c-fe6b-4c69-a69b-a5fe6fd4ca29' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '876d3493-e96f-4832-93da-dbf568b8837f' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '45d6703d-2f8d-4499-9cb1-6c2f32ccbbd6' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = 'cd934ade-c6ad-41f5-bbbf-ab992a0583c1' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chiang Mai City Municipality, Fa Ham, Mueang Chiang Mai District, Chiang Mai Province, Thailand', 'latitude', 18.7882778, 'longitude', 98.9858802, 'city', 'Chiang Mai City Municipality', 'district', 'Mueang Chiang Mai District', 'placeId', 'relation:18271830'))
where id = '42b0b600-2bba-4966-be6e-fec7744df064' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = 'ac8a0172-26e9-4d0d-9d2d-449dfdbe2cbb' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Nakhon Ratchasima City Municipality, Mueang Nakhon Ratchasima District, Nakhon Ratchasima Province, 30000, Thailand', 'latitude', 14.9749389, 'longitude', 102.0981358, 'city', 'Nakhon Ratchasima City Municipality', 'district', 'Mueang Nakhon Ratchasima District', 'placeId', 'relation:17770565'))
where id = '41c2d42e-ed36-4855-90d4-7974d9ed285a' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', '中德.英伦城邦K区, Zhonghe, High-Tech Zone (South), Shuangliu District, Chengdu, Sichuan, China', 'latitude', 30.5075538, 'longitude', 104.0724568, 'city', 'Shuangliu District', 'district', 'Zhonghe', 'placeId', 'way:484506429'))
where id = '77e42625-65e5-4447-a175-4e4766ccdc8d' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chiang Mai City Municipality, Fa Ham, Mueang Chiang Mai District, Chiang Mai Province, Thailand', 'latitude', 18.7882778, 'longitude', 98.9858802, 'city', 'Chiang Mai City Municipality', 'district', 'Mueang Chiang Mai District', 'placeId', 'relation:18271830'))
where id = '59d5eebe-7096-420a-bc97-059548cfef9d' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = 'b4295a42-135b-4021-b684-64310cfecbb2' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Seattle, King County, Washington, United States', 'latitude', 47.6038321, 'longitude', -122.330062, 'city', 'Seattle', 'district', 'King County', 'placeId', 'relation:237385'))
where id = '6e53fbeb-c831-4e86-87c5-3084d4f31dc5' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Nakhon Ratchasima City Municipality, Mueang Nakhon Ratchasima District, Nakhon Ratchasima Province, 30000, Thailand', 'latitude', 14.9749389, 'longitude', 102.0981358, 'city', 'Nakhon Ratchasima City Municipality', 'district', 'Mueang Nakhon Ratchasima District', 'placeId', 'relation:17770565'))
where id = '3d738077-15f4-420e-95f2-0ab05dd0b9e9' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Nakhon Ratchasima City Municipality, Mueang Nakhon Ratchasima District, Nakhon Ratchasima Province, 30000, Thailand', 'latitude', 14.9749389, 'longitude', 102.0981358, 'city', 'Nakhon Ratchasima City Municipality', 'district', 'Mueang Nakhon Ratchasima District', 'placeId', 'relation:17770565'))
where id = '7a2196c0-060a-4902-82fe-8e83e0fca986' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'New York, United States', 'latitude', 40.7127281, 'longitude', -74.0060152, 'city', 'New York', 'district', null, 'placeId', 'relation:175905'))
where id = 'd736aadc-9dbe-4778-adde-078af8731995' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = '7e9306f7-c916-4959-8f6e-fc5038e737cd' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chiang Mai International Airport, 60, Airport Road, Suthep Subdistrict, Suthep Town Municipality, Pa Daet, Mueang Chiang Mai District, Chiang Mai Province, 50200, Thailand', 'latitude', 18.7668427, 'longitude', 98.9648781, 'city', 'Suthep Town Municipality', 'district', 'Suthep Subdistrict', 'placeId', 'relation:12410725'))
where id = '40197c96-2fd4-48ba-94ca-e19ad50a4518' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'HomePro - Chaing Mai Ruamchok, 203/16, Chiang Mai-Phrao Road, Fa Ham Subdistrict Municipality, Mueang Chiang Mai District, Chiang Mai Province, 50000, Thailand', 'latitude', 18.8251457, 'longitude', 99.0138353, 'city', null, 'district', 'Mueang Chiang Mai District', 'placeId', 'way:1356111268'))
where id = '310e408a-024d-4e56-89ce-341f71102c5c' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = 'ced6edbc-e865-415f-a501-a129168c55fc' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '583539db-c427-47e8-93e1-e86928cecf0c' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = '106c946d-c2b7-4f84-a412-16b6ebd9b119' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = 'e77d18a7-0f0d-45e9-947d-e47ea848c6a9' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Phuket Province, Thailand', 'latitude', 7.9366015, 'longitude', 98.3529292, 'city', null, 'district', null, 'placeId', 'relation:2934604'))
where id = 'c7030a0f-4539-4618-973d-2214e4dc9c0d' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = '8e2acc77-f7a9-473c-bed8-e07bb2a602d4' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Khon Kaen Province, Thailand', 'latitude', 16.6022387, 'longitude', 102.6352933, 'city', null, 'district', null, 'placeId', 'relation:1908778'))
where id = '2e9806f2-0a58-4939-b20b-8d52eac29b93' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Ban Bang Sao Thong, Bang Sao Thong Subdistrict, Bang Sao Thong Subdistrict Administrative Organization, Bang Sao Thong District, Samut Prakan Province, 10560, Thailand', 'latitude', 13.5976106, 'longitude', 100.8221822, 'city', 'Bang Sao Thong Subdistrict', 'district', 'Bang Sao Thong Subdistrict Administrative Organization', 'placeId', 'node:9672160982'))
where id = 'a25f0545-2cd4-4069-aa3c-00d0590becf1' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = 'adcde12a-5eb1-4b4e-905d-cfb0766ad09a' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '3a1a557f-45f5-442b-bd26-5d6721471c23' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Asok, Sukhumvit Road, Sukhumvit, Khlong Toei Subdistrict, Khlong Toei District, Bangkok, 10110, Thailand', 'latitude', 13.7370432, 'longitude', 100.5603571, 'city', 'Bangkok', 'district', 'Khlong Toei District', 'placeId', 'node:5391625873'))
where id = 'd870cc4d-aadc-466e-8b2e-1db134e27cb6' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chidlom, Chit Lom Road, Ratchaprasong, Lumphini Subdistrict, Pathum Wan District, Bangkok, 10330, Thailand', 'latitude', 13.7487051, 'longitude', 100.5445742, 'city', 'Bangkok', 'district', 'Pathum Wan District', 'placeId', 'node:566622607'))
where id = 'ffa6d2de-e47a-4325-b7e0-e9e67673ba09' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Udon Thani Province, Thailand', 'latitude', 17.5211917, 'longitude', 102.6680012, 'city', null, 'district', null, 'placeId', 'relation:1908831'))
where id = '2102a165-6aba-488a-a276-f5c578407d08' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Phuket Province, Thailand', 'latitude', 7.9366015, 'longitude', 98.3529292, 'city', null, 'district', null, 'placeId', 'relation:2934604'))
where id = '2e5009d4-2a60-476e-832c-8203dab120f6' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Chiang Mai City Municipality, Fa Ham, Mueang Chiang Mai District, Chiang Mai Province, Thailand', 'latitude', 18.7882778, 'longitude', 98.9858802, 'city', 'Chiang Mai City Municipality', 'district', 'Mueang Chiang Mai District', 'placeId', 'relation:18271830'))
where id = '89489433-2891-495b-86f5-eafe721e5e17' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Pattaya City, Nong Pla Lai, Bang Lamung District, Chon Buri Province, Thailand', 'latitude', 12.9366924, 'longitude', 100.8865002, 'city', 'Pattaya City', 'district', 'Bang Lamung District', 'placeId', 'relation:12645794'))
where id = '1ad68726-f4d1-4fc4-ac3d-dcd0ca41108c' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Khon Kaen Province, Thailand', 'latitude', 16.6022387, 'longitude', 102.6352933, 'city', null, 'district', null, 'placeId', 'relation:1908778'))
where id = '84d36116-814c-42e2-8279-db9748d8e916' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Phuket Province, Thailand', 'latitude', 7.9366015, 'longitude', 98.3529292, 'city', null, 'district', null, 'placeId', 'relation:2934604'))
where id = '884e7c1f-5b2f-4668-91f1-a0fbd19f52f7' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Udon Thani Province, Thailand', 'latitude', 17.5211917, 'longitude', 102.6680012, 'city', null, 'district', null, 'placeId', 'relation:1908831'))
where id = 'ba18200a-039f-4f0f-bf48-a6ee4c6d4643' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '65d0e98a-509b-449b-874d-a477e8519ebf' and locations = '[]'::jsonb;

update public.freelancer_profiles set locations = jsonb_build_array(jsonb_build_object('formattedAddress', 'Bangkok, Thailand', 'latitude', 13.7524938, 'longitude', 100.4935089, 'city', 'Bangkok', 'district', null, 'placeId', 'relation:92277'))
where id = '5c80d2b7-95e0-4a48-b3d1-a13139decdc5' and locations = '[]'::jsonb;

