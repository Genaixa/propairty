from typing import Optional
from pydantic import BaseModel, model_validator

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    restrict_to_assigned: Optional[bool] = False
    organisation_id: int
    organisation_name: Optional[str] = None
    avatar_url: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def extract_org_name(cls, data):
        if hasattr(data, 'organisation') and data.organisation:
            data.__dict__['organisation_name'] = data.organisation.name
        return data

    class Config:
        from_attributes = True
