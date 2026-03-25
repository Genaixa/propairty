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
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    app_base_url: str = "https://propairty.co.uk"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""  # e.g. whatsapp:+14155238886
    twilio_sms_from: str = ""      # e.g. +14155238886

    class Config:
        env_file = ".env.production"
        env_file_encoding = "utf-8"

settings = Settings()
