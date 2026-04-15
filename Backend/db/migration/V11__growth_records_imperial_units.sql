-- Switch growth_records from metric to imperial units.
ALTER TABLE growth_records RENAME COLUMN weight_kg TO weight_lbs;
ALTER TABLE growth_records ALTER COLUMN weight_lbs TYPE NUMERIC(6,2);

ALTER TABLE growth_records RENAME COLUMN height_cm TO height_in;
ALTER TABLE growth_records ALTER COLUMN height_in TYPE NUMERIC(5,2);

ALTER TABLE growth_records RENAME COLUMN head_cm TO head_in;
ALTER TABLE growth_records ALTER COLUMN head_in TYPE NUMERIC(5,2);
