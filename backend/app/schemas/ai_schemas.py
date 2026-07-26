from typing import List, Optional
from pydantic import BaseModel, Field

# =========================================================================
# 1. RESUME PARSING SCHEMAS (Skill, Experience, Education, Project Extraction)
# =========================================================================

class WorkExperienceSchema(BaseModel):
    company: str = Field(..., description="Name of the company or organization")
    title: str = Field(..., description="Job title / role held by the candidate")
    start_date: Optional[str] = Field(None, description="Start date of the employment (e.g., 'MM/YYYY' or 'Year')")
    end_date: Optional[str] = Field(None, description="End date of the employment, or 'Present'")
    responsibilities: List[str] = Field(default_factory=list, description="Key duties, achievements, and impact of the candidate")

class EducationSchema(BaseModel):
    school: str = Field(..., description="Name of the university, college, or school")
    degree: str = Field(..., description="Degree or certificate obtained (e.g., B.S., M.S., Ph.D., High School)")
    major: Optional[str] = Field(None, description="Field of study or major specialization")
    graduation_year: Optional[str] = Field(None, description="Year of graduation")

class ProjectSchema(BaseModel):
    title: str = Field(..., description="Title of the project")
    description: str = Field(..., description="Detailed description of what the project accomplished")
    technologies: List[str] = Field(default_factory=list, description="Tech stack or specific tools used in the project")

class ParsedResumeDetailedSchema(BaseModel):
    name: str = Field(..., description="The candidate's full name")
    email: Optional[str] = Field(None, description="Candidate's primary email address")
    phone: Optional[str] = Field(None, description="Candidate's primary phone number")
    location: Optional[str] = Field(None, description="Candidate's physical location / city & state")
    summary: Optional[str] = Field(None, description="Executive summary or professional headline")
    skills: List[str] = Field(default_factory=list, description="Extracted tech stack, programming languages, libraries, frameworks, or methodologies")
    experience: List[WorkExperienceSchema] = Field(default_factory=list, description="List of work experience entries")
    education: List[EducationSchema] = Field(default_factory=list, description="List of education background entries")
    projects: List[ProjectSchema] = Field(default_factory=list, description="List of portfolio or side-projects")


# =========================================================================
# 2. MATCHING & SCREENING SCHEMAS (Summary, Recommendations, Gaps)
# =========================================================================

class SkillGapAnalysisSchema(BaseModel):
    matched_skills: List[str] = Field(default_factory=list, description="Skills listed on the resume that match the job description requirements")
    missing_skills: List[str] = Field(default_factory=list, description="Required skills from the job description that the candidate lacks")
    gaps: List[str] = Field(default_factory=list, description="Explanation of overall conceptual or tool-based skill gaps identified")
    severity: str = Field(..., description="Severity of the skill gap relative to the job (e.g., Low, Medium, High)")
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations for how the candidate can bridge these gaps (e.g. training, adjacent skills)")

class CandidateMatchSchema(BaseModel):
    overall_score: int = Field(..., description="Overall fit score from 0 to 100")
    skills_match_score: int = Field(..., description="How well candidate's skills align with job requirements (0-100)")
    experience_match_score: int = Field(..., description="How well candidate's experience duration and depth match requirements (0-100)")
    education_match_score: int = Field(..., description="How well candidate's education matches requested background (0-100)")
    summary: str = Field(..., description="A 3-4 sentence comprehensive overview of the candidate's strengths, constraints, and alignment")
    recommendation: str = Field(..., description="Clear hiring recommendation: 'Highly Recommended', 'Recommended', 'Borderline', or 'Not Recommended'")
    explanation: str = Field(..., description="Detailed markdown justification for the assigned scores and decisions")
    gap_analysis: SkillGapAnalysisSchema = Field(..., description="In-depth skill gap analysis and remediation")


# =========================================================================
# 3. INTERVIEW QUESTIONS SCHEMAS
# =========================================================================

class InterviewQuestionItemSchema(BaseModel):
    question: str = Field(..., description="The customized interview question")
    expected_answer: str = Field(..., description="What metrics / elements recruiters should look for in a strong candidate answer")
    category: str = Field(..., description="Question category (e.g. Technical, Behavioral, Scenario, Problem Solving)")
    targeted_skill_or_gap: str = Field(..., description="The specific skill, experience, or gap that this question targets")

class InterviewQuestionsListSchema(BaseModel):
    questions: List[InterviewQuestionItemSchema] = Field(..., description="List of tailored interview questions")


# =========================================================================
# 4. CANDIDATE RANKING SCHEMAS (Vector-based ChromaDB query outcomes)
# =========================================================================

class CandidateRankItemSchema(BaseModel):
    candidate_id: int = Field(..., description="The unique candidate identifier")
    name: str = Field(..., description="Candidate name")
    semantic_score: float = Field(..., description="Semantic similarity match score from ChromaDB (normalized between 0.0 and 1.0)")
    explanation: str = Field(..., description="A short, concise explanation of why this candidate ranked where they did")

class CandidateRankResponseSchema(BaseModel):
    rankings: List[CandidateRankItemSchema] = Field(..., description="Ordered list of ranked candidates against the job description")


# =========================================================================
# 5. RECRUITER CHAT SCHEMAS (Conversational Copilot)
# =========================================================================

class RecruiterChatResponseSchema(BaseModel):
    response: str = Field(..., description="Natural language response from the AI recruiter co-pilot")
    citations: List[str] = Field(default_factory=list, description="Quotes or sections cited from the candidate's resume or the job description")
    suggested_followups: List[str] = Field(default_factory=list, description="Suggested follow-up questions the recruiter might ask")
