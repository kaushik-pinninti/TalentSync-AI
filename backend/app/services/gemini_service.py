import json
from typing import List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import settings

# Structured output Pydantic classes for Gemini response schemas
class ParsedResumeSchema(BaseModel):
    name: str = Field(..., description="The candidate's full name")
    email: Optional[str] = Field(None, description="Candidate email address")
    phone: Optional[str] = Field(None, description="Candidate contact phone number")
    education_summary: Optional[str] = Field(None, description="Summary of candidate's degrees and schools")
    experience_summary: Optional[str] = Field(None, description="Summary of candidate's employment history")
    skills: List[str] = Field(default_factory=list, description="Extracted tech stack, programming languages, libraries, frameworks, or methodologies")

class AIMatchSchema(BaseModel):
    overall_score: int = Field(..., description="Overall fit score from 0 to 100")
    skills_match_score: int = Field(..., description="How well candidate's skills align with job requirements (0-100)")
    experience_match_score: int = Field(..., description="How well candidate's experience duration and depth match requirements (0-100)")
    education_match_score: int = Field(..., description="How well candidate's education matches requested background (0-100)")
    matched_skills: List[str] = Field(default_factory=list, description="Skills listed on the resume that match the job description requirements")
    missing_skills: List[str] = Field(default_factory=list, description="Required skills from the job description that the candidate is missing")
    summary: str = Field(..., description="A 2-3 sentence overview of the candidate's alignment with the job")
    recommendation: str = Field(..., description="Actionable screening recommendation (e.g., Strong Yes, Yes, Hold, No)")
    explanation: str = Field(..., description="Detailed markdown justification for the assigned scores and gaps")

class QuestionItemSchema(BaseModel):
    question: str = Field(..., description="The interview question")
    expected_answer: str = Field(..., description="What to look for in a strong candidate answer")
    category: str = Field(..., description="Question category (e.g. Technical, Behavioral, Problem Solving)")

class InterviewQuestionsListSchema(BaseModel):
    questions: List[QuestionItemSchema] = Field(..., description="List of generated questions")

class GeminiService:
    _client: Optional[genai.Client] = None

    @classmethod
    def _get_client(cls) -> genai.Client:
        """
        Lazy initialization of the official Google GenAI Client.
        Fails fast with a clear error message if the GEMINI_API_KEY is not configured.
        """
        if not cls._client:
            api_key = settings.GEMINI_API_KEY
            if not api_key or api_key == "YOUR_GEMINI_API_KEY":
                raise ValueError("GEMINI_API_KEY environment variable is required but is missing or not configured.")
            
            # Initialize with the standard GenAI Client
            cls._client = genai.Client(api_key=api_key)
        return cls._client

    @classmethod
    def parse_resume(cls, resume_text: str) -> ParsedResumeSchema:
        """
        Parses raw resume text and extracts contact details, education, work experience, and skills in a structured format.
        """
        client = cls._get_client()
        
        prompt = f"""
        Extract candidate details from the following resume text.
        Make sure to identify the name, email, phone, and compile clean lists of skills, education, and experience.
        
        Resume Content:
        {resume_text}
        """
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ParsedResumeSchema,
            system_instruction="You are a professional recruiting assistant specialized in parsing complex text resumes into pristine JSON configurations. Always extract correct entities.",
            temperature=0.1,
        )
        
        # We use gemini-3.5-flash for basic text extraction tasks as per SKILL.md guidelines
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )
        
        # Parse the JSON response into our Pydantic schema
        try:
            parsed_data = json.loads(response.text)
            return ParsedResumeSchema(**parsed_data)
        except Exception as e:
            # Fallback in case of parse discrepancies
            raise RuntimeError(f"Failed to parse resume JSON response from Gemini: {str(e)}. Response text was: {response.text}")

    @classmethod
    def match_candidate(cls, resume_text: str, job_title: str, job_description: str, job_skills: List[str]) -> AIMatchSchema:
        """
        Screens and matches candidate resume details against job specifications using Gemini's advanced text reasoning.
        """
        client = cls._get_client()
        
        prompt = f"""
        Evaluate how well the candidate's resume aligns with the job profile.
        
        Job Title: {job_title}
        Job Description:
        {job_description}
        
        Required Job Skills: {', '.join(job_skills)}
        
        Candidate Resume Content:
        {resume_text}
        """
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AIMatchSchema,
            system_instruction="You are a senior technical hiring manager. Critically analyze the resume against the job description. Evaluate matching keywords, duration/relevance of experiences, and education. Produce honest, precise scores and a detailed justification.",
            temperature=0.2,
        )
        
        # Using gemini-3.5-flash for matching tasks to maintain fast latency and cost efficiency
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )
        
        try:
            parsed_data = json.loads(response.text)
            return AIMatchSchema(**parsed_data)
        except Exception as e:
            raise RuntimeError(f"Failed to parse match report JSON response from Gemini: {str(e)}. Response: {response.text}")

    @classmethod
    def generate_interview_questions(cls, candidate_name: str, candidate_skills: List[str], job_title: str, job_description: str, count: int = 5) -> InterviewQuestionsListSchema:
        """
        Generates tailormade interview questions targeting matching credentials and critical skill gaps.
        """
        client = cls._get_client()
        
        prompt = f"""
        Generate {count} targeted, expert-level interview questions for candidate '{candidate_name}' applying for the role '{job_title}'.
        
        Job Description:
        {job_description}
        
        Candidate Extracted Skills: {', '.join(candidate_skills)}
        
        Ensure questions cover:
        1. Deep technical competency of their listed skills.
        2. Probing questions around missing skills or gaps relative to the job.
        3. Behavioral or situation-handling scenarios tailored to this seniority.
        """
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=InterviewQuestionsListSchema,
            system_instruction="You are an expert tech lead and behavioral interviewer. Create thoughtful, high-fidelity interview questions. For every question, outline the exact criteria and points recruiters should look for in a top-performing candidate's response.",
            temperature=0.7,
        )
        
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )
        
        try:
            parsed_data = json.loads(response.text)
            return InterviewQuestionsListSchema(**parsed_data)
        except Exception as e:
            raise RuntimeError(f"Failed to parse questions JSON response from Gemini: {str(e)}. Response: {response.text}")
