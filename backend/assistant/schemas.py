from pydantic import BaseModel, Field


class AssistantLLMResult(BaseModel):
    mode: str = "support"
    message: str = ""
    summary: str = ""
    main_category: str = ""
    subcategories: list[str] = Field(default_factory=list)
    danger_flag: bool = False
    should_end_session: bool = False
    should_show_recommendations: bool = False
    should_store_summary: bool = False

