ALTER TABLE game_wallets ADD COLUMN allowed_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7];
ALTER TABLE game_wallets ADD CONSTRAINT game_wallet_allowed_days CHECK (array_position(allowed_days,NULL) IS NULL AND allowed_days <@ ARRAY[1,2,3,4,5,6,7] AND cardinality(allowed_days)<=7);
