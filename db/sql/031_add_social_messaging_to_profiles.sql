-- Add WhatsApp and Telegram fields to profiles table
ALTER TABLE profiles
ADD COLUMN whatsapp_number_e164 TEXT,
ADD COLUMN telegram_username TEXT,
ADD COLUMN share_whatsapp BOOLEAN DEFAULT FALSE,
ADD COLUMN share_telegram BOOLEAN DEFAULT FALSE;

-- Add indexes for faster lookups
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_number_e164) WHERE whatsapp_number_e164 IS NOT NULL;
CREATE INDEX idx_profiles_telegram ON profiles(telegram_username) WHERE telegram_username IS NOT NULL;

-- Add comments
COMMENT ON COLUMN profiles.whatsapp_number_e164 IS 'WhatsApp phone number in E.164 format (e.g., +972501234567)';
COMMENT ON COLUMN profiles.telegram_username IS 'Telegram username without @ symbol (e.g., some_user)';
COMMENT ON COLUMN profiles.share_whatsapp IS 'Whether user allows sharing WhatsApp contact with matched users';
COMMENT ON COLUMN profiles.share_telegram IS 'Whether user allows sharing Telegram contact with matched users';
