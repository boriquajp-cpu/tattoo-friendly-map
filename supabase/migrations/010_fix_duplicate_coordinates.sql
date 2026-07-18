-- =============================================================================
-- 010_fix_duplicate_coordinates.sql
-- 座標が他施設と重複していた25施設のうち、20施設を施設名検索で個別に再ジオコーディング
-- =============================================================================

UPDATE facilities SET lat = 34.9803565, lng = 135.7477025 WHERE id = '3e3a00af-24c8-4ad8-87b7-438814ac2634';
UPDATE facilities SET lat = 35.0121779, lng = 135.7623131 WHERE id = '796b7ec5-ed87-43f8-abb0-5b3bd4143f91';
UPDATE facilities SET lat = 35.0203246, lng = 135.7370882 WHERE id = '07a5ab09-fe2f-425c-b8b6-d1a0935e7acd';
UPDATE facilities SET lat = 35.0177833, lng = 135.769568 WHERE id = '60e407ae-aed6-40ec-908c-50618a04c5af';
UPDATE facilities SET lat = 35.0114557, lng = 135.6804022 WHERE id = 'ae387b13-0eef-4f6c-a2eb-4fbfbff9f2e3';
UPDATE facilities SET lat = 42.965817, lng = 141.1631267 WHERE id = '7f6a0a6f-883e-41d0-995f-e2ea47fa5e0a';
UPDATE facilities SET lat = 42.9636354, lng = 141.1595527 WHERE id = '0a6a264b-8ca1-450d-8755-d26aa2f91e32';
UPDATE facilities SET lat = 42.9642951, lng = 141.1637367 WHERE id = 'a56794eb-9552-4616-95e6-f47dafdf3266';
UPDATE facilities SET lat = 42.966489, lng = 141.169688 WHERE id = 'cd406da4-1a67-416d-9f88-8fcda9dae59a';
UPDATE facilities SET lat = 43.1008987, lng = 141.3775371 WHERE id = 'af686335-1594-4da0-ac9f-a761da47929d';
UPDATE facilities SET lat = 43.0840477, lng = 141.3755938 WHERE id = 'a215c1a3-9c59-4799-910f-4d1de8bb9fd4';
UPDATE facilities SET lat = 42.4951825, lng = 141.1448378 WHERE id = '7d10e3e7-fd98-431d-9538-8c6b10635e28';
UPDATE facilities SET lat = 42.4916512, lng = 141.1442029 WHERE id = 'b99a8ccb-4657-4e62-a334-079177f162b7';
UPDATE facilities SET lat = 42.8731433, lng = 140.6393543 WHERE id = 'a0e8ded8-a457-4d5c-adca-94925bdf7667';
UPDATE facilities SET lat = 34.9759721, lng = 135.687789 WHERE id = '929c782e-d857-4360-bae7-1d88f8759b1e';
UPDATE facilities SET lat = 42.4922268, lng = 141.1430141 WHERE id = '3a674e6b-bf99-407d-9fc1-ea6cb7c4237d';
UPDATE facilities SET lat = 42.4884785, lng = 141.1472653 WHERE id = '0e2fbd6a-6fce-430d-a9d0-9df655b56767';
UPDATE facilities SET lat = 42.8083243, lng = 140.68528 WHERE id = '7cef2846-e191-4e0c-b9bd-45ffbf755bb4';
UPDATE facilities SET lat = 42.8438249, lng = 140.6345568 WHERE id = 'e2a5366f-4acc-4ccd-813c-19903900ec54';
UPDATE facilities SET lat = 42.49176, lng = 141.1418722 WHERE id = '079cd111-0dfe-4219-bbe5-608e7710aecc';
