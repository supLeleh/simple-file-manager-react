from pydantic import BaseModel


class ConfigFileModel(BaseModel):
    filename: str
