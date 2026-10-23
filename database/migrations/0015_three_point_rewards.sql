BEGIN;
ALTER TABLE game_wallets ALTER COLUMN reward_points SET DEFAULT 3;
ALTER TABLE game_wallets ALTER COLUMN seconds_per_point SET DEFAULT 60;
UPDATE game_wallets SET reward_points=3,seconds_per_point=60;
COMMIT;
