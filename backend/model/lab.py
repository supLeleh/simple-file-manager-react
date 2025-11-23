from pydantic import BaseModel


# Representation of Lab to be used as Body Request (will add eventually more fields)
class Lab(BaseModel):
    hash: str | None = None
