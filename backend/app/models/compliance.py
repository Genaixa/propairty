from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

CERT_TYPES = {
    "gas_safety":          {"label": "Gas Safety Certificate",              "validity_years": 1},
    "epc":                 {"label": "EPC (Energy Performance Certificate)", "validity_years": 10},
    "eicr":                {"label": "EICR (Electrical)",                   "validity_years": 5},
    "fire_risk":           {"label": "Fire Risk Assessment",                "validity_years": 1},
    "legionella":          {"label": "Legionella Risk Assessment",          "validity_years": 2},
    "pat":                 {"label": "PAT Testing",                         "validity_years": 1},
    "co_alarm":            {"label": "CO Alarm Check",                      "validity_years": 1},
    "hmo_licence":         {"label": "HMO Licence",                         "validity_years": 5},
    "smoke_alarm":         {"label": "Smoke Alarm Check",                   "validity_years": 1},
    "asbestos":            {"label": "Asbestos Survey",                     "validity_years": 10},
    "deposit_protection":  {"label": "Deposit Protection (TDS/DPS)",        "validity_years": 0},
}

class ComplianceCertificate(Base):
    __tablename__ = "compliance_certificates"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    cert_type = Column(String, nullable=False)   # gas_safety, epc, eicr, etc.
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    reference = Column(String, nullable=True)    # certificate number
    contractor = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    property = relationship("Property", backref="certificates")
