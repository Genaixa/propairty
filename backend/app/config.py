from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    secret_key: str = "propairty-dev-secret-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./propairty.db"
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "PropAIrty <noreply@propairty.co.uk>"
    imap_host: str = "imap.one.com"
    imap_port: int = 993
    imap_user: str = ""
    imap_password: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_tenant_id: str = "common"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    app_base_url: str = "https://propairty.co.uk"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""  # e.g. whatsapp:+14155238886
    twilio_sms_from: str = ""      # e.g. +14155238886
    stripe_price_id: str = ""      # Stripe Price ID for the PropAIrty monthly subscription
    pexels_api_key: str = ""
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    mistral_api_key: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    # HMRC Making Tax Digital — register at developer.service.hmrc.gov.uk
    hmrc_client_id: str = ""
    hmrc_client_secret: str = ""
    hmrc_sandbox: bool = True  # False = production API

    class Config:
        env_file = ".env.production"
        env_file_encoding = "utf-8"

settings = Settings()
