import os
import json
import time
from functools import wraps
from typing import List, Dict, Any, Optional

from google import genai
from google.genai import types

from app.config import settings
from app.utils.logger import logger
from app.schemas.ai_schemas import (
    ParsedResumeDetailedSchema,
    CandidateMatchSchema,
    InterviewQuestionsListSchema,
    CandidateRankResponseSchema,
    CandidateRankItemSchema,
    RecruiterChatResponseSchema,
    SkillGapAnalysisSchema,
    WorkExperienceSchema,
    EducationSchema,
    ProjectSchema
)

# =========================================================================
# 1. RETRY DECORATOR FOR ROBUST FAILURE HANDLING
# =========================================================================

def retry_on_failure(retries: int = 3, delay: float = 1.0, backoff: float = 2.0, exceptions=(Exception,)):
    """
    Production-ready decorator that retries a function with exponential backoff on exceptions.
    Logs warnings for each failure and errors out if all retries are exhausted.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            m_delay = delay
            for attempt in range(retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == retries - 1:
                        logger.error(
                            f"Operation {func.__name__} failed after {retries} attempts. "
                            f"Error details: {str(e)}",
                            exc_info=True
                        )
                        raise e
                    logger.warning(
                        f"Operation {func.__name__} failed on attempt {attempt + 1}/{retries}. "
                        f"Retrying in {m_delay:.2f}s. Exception: {str(e)}"
                    )
                    time.sleep(m_delay)
                    m_delay *= backoff
        return wrapper
    return decorator


# =========================================================================
# 2. EMBEDDING ENGINE (Sentence Transformers with Gemini API Fallback)
# =========================================================================

SENTENCE_TRANSFORMERS_AVAILABLE = False
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
    logger.info("Sentence Transformers library loaded successfully.")
except ImportError:
    logger.warning("Sentence Transformers library not found. Will use Google GenAI embedding API fallback.")


class EmbeddingEngine:
    """
    Retrieves high-fidelity vector embeddings for candidate matching and semantic queries.
    Uses Sentence Transformers as primary provider and Google GenAI's modern 'text-embedding-004'
    as an automatic fallback.
    """
    _local_model = None

    @classmethod
    def get_local_model(cls) -> Optional[Any]:
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            return None
        if cls._local_model is None:
            try:
                # Load a standard, highly performant and lightweight transformer model
                cls._local_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("SentenceTransformer model 'all-MiniLM-L6-v2' loaded successfully.")
            except Exception as e:
                logger.error(f"Failed to load local SentenceTransformer: {str(e)}. Falling back to Gemini.")
                return None
        return cls._local_model

    @classmethod
    @retry_on_failure(retries=3, delay=1.0, backoff=2.0)
    def get_embedding(cls, text: str) -> List[float]:
        """
        Generates vector embeddings with full fail-safety.
        """
        if not text.strip():
            # Return an empty embedding vector (e.g., of dimension 384)
            return [0.0] * 384

        # 1. Attempt Local Sentence Transformers
        model = cls.get_local_model()
        if model is not None:
            try:
                embedding = model.encode(text)
                return embedding.tolist()
            except Exception as e:
                logger.warning(f"Local SentenceTransformer encoding failed: {str(e)}. Retrying with Gemini API...")

        # 2. Fallback to Gemini Embeddings
        api_key = settings.GEMINI_API_KEY
        if not api_key or api_key == "YOUR_GEMINI_API_KEY":
            raise ValueError("GEMINI_API_KEY environment variable is required but is missing or not configured.")
        
        try:
            client = genai.Client(api_key=api_key)
            # Use 'text-embedding-004' as the current, modern standard embedding model
            response = client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            return [float(x) for x in response.embeddings[0].values]
        except Exception as e:
            logger.error(f"Gemini API embedding generation failed: {str(e)}")
            raise RuntimeError(f"All embedding providers failed: {str(e)}")


# =========================================================================
# 3. VECTOR DATABASE (ChromaDB Integration with MemCache Fallback)
# =========================================================================

CHROMADB_AVAILABLE = False
try:
    import chromadb
    CHROMADB_AVAILABLE = True
    logger.info("ChromaDB library loaded successfully.")
except ImportError:
    logger.warning("ChromaDB library not found. Falling back to persistent memory cache.")


class ChromaDBManager:
    """
    Manages vector indexing and retrieval for candidates inside a persistent Chroma DB instance.
    Includes robust fallbacks to Ephemeral Client or local dictionary-based similarity if Chroma is missing.
    """
    _client = None
    _collection = None
    _memory_cache: Dict[str, Dict[str, Any]] = {} # Fallback structure

    @classmethod
    def get_client(cls) -> Optional[Any]:
        if not CHROMADB_AVAILABLE:
            return None
        if cls._client is None:
            try:
                db_path = os.path.join(os.getcwd(), "chroma_data")
                cls._client = chromadb.PersistentClient(path=db_path)
                logger.info(f"ChromaDB persistent client initialized at: {db_path}")
            except Exception as e:
                logger.error(f"Failed to initialize persistent ChromaDB client: {str(e)}. Switching to EphemeralClient.")
                try:
                    cls._client = chromadb.EphemeralClient()
                except Exception as ex:
                    logger.error(f"Failed to initialize Ephemeral ChromaDB client: {str(ex)}")
                    return None
        return cls._client

    @classmethod
    def get_collection(cls) -> Optional[Any]:
        client = cls.get_client()
        if client is None:
            return None
        if cls._collection is None:
            try:
                cls._collection = client.get_or_create_collection(
                    name="candidate_vector_pool",
                    metadata={"hnsw:space": "cosine"} # Direct cosine distance metrics
                )
                logger.info("ChromaDB collection 'candidate_vector_pool' is ready.")
            except Exception as e:
                logger.error(f"Failed to initialize ChromaDB collection: {str(e)}")
                return None
        return cls._collection

    @classmethod
    def add_or_update_candidate(cls, candidate_id: int, text_content: str, metadata: dict) -> bool:
        """
        Embeds and stores a candidate's credentials inside the vector database.
        """
        # Save in memory cache as fallback
        cls._memory_cache[str(candidate_id)] = {
            "text": text_content,
            "metadata": metadata
        }

        collection = cls.get_collection()
        if collection is None:
            logger.warning(f"ChromaDB unavailable. Saved candidate {candidate_id} in local memory cache only.")
            return True
        
        try:
            embedding = EmbeddingEngine.get_embedding(text_content)
            
            # Sanitize metadata for ChromaDB (no lists or dicts allowed in metadata values)
            clean_meta = {}
            for k, v in metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                elif isinstance(v, list):
                    clean_meta[k] = ", ".join([str(x) for x in v])
                else:
                    clean_meta[k] = str(v)

            collection.upsert(
                ids=[str(candidate_id)],
                embeddings=[embedding],
                documents=[text_content],
                metadatas=[clean_meta]
            )
            logger.info(f"Successfully vectorized and stored candidate {candidate_id} in ChromaDB.")
            return True
        except Exception as e:
            logger.error(f"Failed to index candidate {candidate_id} in ChromaDB: {str(e)}", exc_info=True)
            return False

    @classmethod
    def delete_candidate(cls, candidate_id: int) -> bool:
        if str(candidate_id) in cls._memory_cache:
            del cls._memory_cache[str(candidate_id)]

        collection = cls.get_collection()
        if collection is None:
            return True
        try:
            collection.delete(ids=[str(candidate_id)])
            logger.info(f"Successfully removed candidate {candidate_id} from ChromaDB.")
            return True
        except Exception as e:
            logger.error(f"Failed to delete candidate {candidate_id} from ChromaDB: {str(e)}")
            return False

    @classmethod
    def query_closest_candidates(cls, query_text: str, limit: int = 10) -> List[dict]:
        """
        Runs vector similarity queries across the candidate database.
        If ChromaDB fails or is unavailable, falls back to a mock ranking sorted by metadata overlap.
        """
        collection = cls.get_collection()
        if collection is None:
            logger.warning("ChromaDB is unavailable. Falling back to local memory-cache overlap matching.")
            return cls._fallback_memory_query(query_text, limit)
            
        try:
            query_embedding = EmbeddingEngine.get_embedding(query_text)
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit
            )
            
            parsed_results = []
            if results and 'ids' in results and len(results['ids'][0]) > 0:
                ids = results['ids'][0]
                distances = results['distances'][0] if 'distances' in results and results['distances'] else [1.0] * len(ids)
                metadatas = results['metadatas'][0] if 'metadatas' in results and results['metadatas'] else [{}] * len(ids)
                documents = results['documents'][0] if 'documents' in results and results['documents'] else [""] * len(ids)
                
                for idx, cid in enumerate(ids):
                    # Convert distance to normalized similarity (0.0 to 1.0)
                    dist = float(distances[idx])
                    score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
                    
                    parsed_results.append({
                        "candidate_id": int(cid),
                        "score": score,
                        "metadata": metadatas[idx],
                        "document": documents[idx]
                    })
            return parsed_results
        except Exception as e:
            logger.error(f"Vector database query failed: {str(e)}. Falling back to local search.", exc_info=True)
            return cls._fallback_memory_query(query_text, limit)

    @classmethod
    def _fallback_memory_query(cls, query_text: str, limit: int) -> List[dict]:
        """
        Extremely resilient word-overlap / cosine similarity fallback if ChromaDB is offline.
        """
        logger.info("Executing local word-overlap scoring fallback.")
        query_words = set(query_text.lower().split())
        if not query_words:
            return []
            
        results = []
        for cid, item in cls._memory_cache.items():
            candidate_text = item["text"].lower()
            overlap = len(query_words.intersection(set(candidate_text.split())))
            score = min(0.99, overlap / len(query_words)) if len(query_words) > 0 else 0.0
            
            results.append({
                "candidate_id": int(cid),
                "score": score,
                "metadata": item["metadata"],
                "document": item["text"]
            })
            
        # Sort by descending overlap score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]


# =========================================================================
# 4. MAIN ENTERPRISE AI MODULE SERVICE
# =========================================================================

class AIService:
    """
    Production-ready enterprise AI module utilizing Google's Gemini SDK.
    Handles resume parsing, advanced candidate matching, custom question generation,
    vector candidate ranking, and recruiter natural language co-piloting with robust
    retries, strict schemas, and error checking.
    """
    _client: Optional[genai.Client] = None

    @classmethod
    def _get_client(cls) -> genai.Client:
        """
        Lazy-initializes the Google GenAI Client with validation.
        """
        if not cls._client:
            api_key = settings.GEMINI_API_KEY
            if not api_key or api_key == "YOUR_GEMINI_API_KEY":
                raise ValueError("GEMINI_API_KEY environment variable is required but is missing or not configured.")
            cls._client = genai.Client(api_key=api_key)
        return cls._client

    # -------------------------------------------------------------------------
    # A. RESUME PARSING ENGINE (Skills, Experience, Education, Projects)
    # -------------------------------------------------------------------------
    @classmethod
    @retry_on_failure(retries=3, delay=1.0, backoff=2.0, exceptions=(Exception,))
    def parse_resume_detailed(cls, resume_text: str) -> ParsedResumeDetailedSchema:
        """
        Parses raw resume text and extracts granular contact info, summaries,
        detailed work experience, education history, skills, and projects in a structured JSON.
        """
        if not resume_text.strip():
            raise ValueError("Resume text is empty or invalid.")

        client = cls._get_client()
        
        prompt = f"""
        Analyze the following candidate resume text. Extract all relevant information precisely, 
        and map it into the requested JSON schema.
        
        Specifically:
        1. Parse contact details (Full Name, Email, Phone, Location if available).
        2. Identify and compile all distinct technical and soft skills into a flat string list.
        3. Extract all work experience chronologically, identifying company name, job title, dates, and a bulleted list of responsibilities.
        4. Extract all educational achievements (university/school name, degree level, major, graduation year).
        5. Extract all side-projects, hackathons, or portfolio projects (project title, descriptive abstract, tech stack used).

        Resume Content:
        {resume_text}
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ParsedResumeDetailedSchema,
            system_instruction=(
                "You are an elite talent acquisition AI model. Your task is to extract complex "
                "resume texts into perfectly normalized structured schemas. Never invent credentials, "
                "dates, or schools; if a field is absent, leave it null or empty. Ensure lists are flat and clean."
            ),
            temperature=0.1
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash", # Fast, optimal model for detailed extraction tasks
            contents=prompt,
            config=config
        )

        try:
            parsed_data = json.loads(response.text)
            return ParsedResumeDetailedSchema(**parsed_data)
        except Exception as e:
            logger.error(f"Failed to parse or validate Gemini schema response: {response.text}", exc_info=True)
            raise RuntimeError(f"Detailed resume parsing failed validation check: {str(e)}")

    # -------------------------------------------------------------------------
    # B. CANDIDATE MATCHING, SUMMARY & RECOMMENDATION ENGINE
    # -------------------------------------------------------------------------
    @classmethod
    @retry_on_failure(retries=3, delay=1.5, backoff=2.0)
    def match_candidate_detailed(
        cls, 
        resume_text: str, 
        job_title: str, 
        job_description: str, 
        job_skills: List[str]
    ) -> CandidateMatchSchema:
        """
        Screens candidate capabilities against a target job role. Evaluates skills alignment,
        calculates detailed segment scores, conducts an extensive Skill Gap Analysis, generates
        a concise recruiter summary, and yields an actionable hiring recommendation.
        """
        client = cls._get_client()

        prompt = f"""
        Perform a comprehensive candidate-to-job matching screening.
        
        Target Job Role: {job_title}
        Required Technical/Core Skills: {', '.join(job_skills)}
        Job Description:
        {job_description}
        
        Candidate Resume:
        {resume_text}
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CandidateMatchSchema,
            system_instruction=(
                "You are an expert technical screening partner and senior engineering manager. "
                "Critically evaluate the candidate resume against the job description. "
                "Calculate scores (0-100) carefully and objectively. Do NOT give perfect scores unless "
                "the candidate is an exact flawless fit. Perform a exhaustive Skill Gap Analysis: "
                "identify precisely what skills from the job are missing, explain the severity of "
                "the gaps, and provide actionable recommendations. Offer clear hiring recommendations "
                "('Highly Recommended', 'Recommended', 'Borderline', 'Not Recommended') supported "
                "by clear, constructive markdown justifications."
            ),
            temperature=0.2
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )

        try:
            parsed_data = json.loads(response.text)
            return CandidateMatchSchema(**parsed_data)
        except Exception as e:
            logger.error(f"Failed to parse match schema: {response.text}", exc_info=True)
            raise RuntimeError(f"Candidate matching evaluation failed: {str(e)}")

    # -------------------------------------------------------------------------
    # C. TAILORED INTERVIEW QUESTION GENERATION
    # -------------------------------------------------------------------------
    @classmethod
    @retry_on_failure(retries=3, delay=1.0, backoff=2.0)
    def generate_interview_questions_detailed(
        cls, 
        candidate_name: str, 
        candidate_skills: List[str], 
        job_title: str, 
        job_description: str, 
        count: int = 5
    ) -> InterviewQuestionsListSchema:
        """
        Generates targeted behavioral, scenario, and technical questions centered on the candidate's
        credentials and identified skill gaps.
        """
        client = cls._get_client()

        prompt = f"""
        Generate {count} unique, tailormade interview questions for candidate '{candidate_name}' 
        who has applied for the position of '{job_title}'.
        
        Candidate Skills: {', '.join(candidate_skills)}
        
        Job Description:
        {job_description}
        
        Ensure questions span:
        - Advanced technical competency in their listed core skill set.
        - Deep dives into critical skills required by the job but missing or thin on their profile.
        - Problem-solving and architectural scenarios matching the seniority of the role.
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=InterviewQuestionsListSchema,
            system_instruction=(
                "You are a professional recruiting coordinator. Craft deep, thought-provoking questions. "
                "For every question, supply a concrete expected answer guide, detailing the technical terms, "
                "frameworks, or behavioral signals (e.g. STAR method signals) recruiters should look for "
                "to grade the candidate as outstanding."
            ),
            temperature=0.7
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
            logger.error(f"Failed to parse interview questions schema: {response.text}", exc_info=True)
            raise RuntimeError(f"Interview questions generation failed: {str(e)}")

    # -------------------------------------------------------------------------
    # D. VECTOR-BASED CANDIDATE RANKING (ChromaDB + Sentence Transformers)
    # -------------------------------------------------------------------------
    @classmethod
    @retry_on_failure(retries=2, delay=1.0, backoff=2.0)
    def rank_candidates(
        cls, 
        job_title: str, 
        job_description: str, 
        job_skills: List[str], 
        candidates_list: List[Dict[str, Any]], 
        limit: int = 10
    ) -> CandidateRankResponseSchema:
        """
        Ranks multiple candidates against a target job specification.
        1. Vectorizes and indices all provided candidates into the ChromaDB vector database.
        2. Executes a semantic vector similarity search using the Job description + skills as query.
        3. Refines similarity ratings and provides detailed justification for the rankings.
        """
        if not candidates_list:
            return CandidateRankResponseSchema(rankings=[])

        # Step 1: Ingest/index all candidates dynamically in ChromaDB
        for cand in candidates_list:
            cid = cand.get("id")
            name = cand.get("name", "Unknown")
            resume_text = cand.get("resume_text", "")
            skills = cand.get("skills", [])
            
            # Compile a rich semantic document for vectorization
            document_content = f"""
            Candidate Name: {name}
            Skills List: {', '.join(skills)}
            Experience Summary: {cand.get('experience_summary', '')}
            Education Summary: {cand.get('education_summary', '')}
            Detailed Resume Text:
            {resume_text}
            """
            
            metadata = {
                "name": name,
                "skills": skills,
                "email": cand.get("email") or "",
                "phone": cand.get("phone") or ""
            }
            
            ChromaDBManager.add_or_update_candidate(
                candidate_id=cid,
                text_content=document_content,
                metadata=metadata
            )

        # Step 2: Formulate the query document and retrieve closest candidates via vector similarity
        query_document = f"""
        Job Title: {job_title}
        Required Tech Stack & Skills: {', '.join(job_skills)}
        Role Description & Goals:
        {job_description}
        """
        
        closest_candidates = ChromaDBManager.query_closest_candidates(query_document, limit=limit)
        
        # Step 3: Call Gemini to review matches and formulate clear descriptions for rankings
        client = cls._get_client()
        
        # Compile contextual payload for Gemini validation
        matches_payload = []
        for cand in closest_candidates:
            matches_payload.append({
                "candidate_id": cand["candidate_id"],
                "name": cand["metadata"].get("name", "Candidate"),
                "similarity_score": round(cand["score"] * 100, 1),
                "skills": cand["metadata"].get("skills", "")
            })
            
        prompt = f"""
        We have executed a vector search (using Sentence Transformers and ChromaDB) to match candidates 
        for the role '{job_title}'.
        
        Job Requirements:
        {query_document}
        
        Calculated Candidate Vector Match Strengths:
        {json.dumps(matches_payload, indent=2)}
        
        Create a beautiful, fully validated, ranked JSON output mapping these candidates into the schema.
        Provide a concise, human-like 1-2 sentence recruiter-facing justification explaining why each candidate
        ranked where they did (focus on their technical overlap or gaps).
        """
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CandidateRankResponseSchema,
            system_instruction=(
                "You are an advanced talent analytics engine. Review the vector similarity scores "
                "and candidate credentials. Output a clean ordered ranking list matching the schema. "
                "Ensure scores are converted to normalized floats from 0.0 to 1.0 (e.g. 85.5% similarity is 0.85). "
                "Write professional, actionable explanations for each candidate's fit."
            ),
            temperature=0.1
        )
        
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )
        
        try:
            parsed_data = json.loads(response.text)
            return CandidateRankResponseSchema(**parsed_data)
        except Exception as e:
            logger.error(f"Failed to generate ranking explanation schema: {response.text}", exc_info=True)
            # Safe schema fallback in case of JSON parse failure
            fallback_items = []
            for item in matches_payload:
                fallback_items.append(CandidateRankItemSchema(
                    candidate_id=item["candidate_id"],
                    name=item["name"],
                    semantic_score=item["similarity_score"] / 100.0,
                    explanation=f"Identified with {item['similarity_score']}% semantic similarity overlap to the target profile."
                ))
            return CandidateRankResponseSchema(rankings=fallback_items)

    # -------------------------------------------------------------------------
    # E. STATEFUL NATURAL LANGUAGE RECRUITER CO-PILOT CHAT
    # -------------------------------------------------------------------------
    @classmethod
    @retry_on_failure(retries=3, delay=1.0, backoff=1.5)
    def chat_with_recruiter(
        cls, 
        conversation_history: List[Dict[str, str]], 
        user_message: str, 
        candidate_profile_text: str, 
        job_profile_text: str
    ) -> RecruiterChatResponseSchema:
        """
        Powers a conversational recruiter agent. Enables recruiters to ask arbitrary questions
        about a candidate (e.g. 'Can this candidate lead cloud migrations?', 'What are their education details?'),
        and returns a structured JSON payload with markdown responses, exact resume quotes/citations, and relevant follow-ups.
        """
        client = cls._get_client()

        # Build context prompt
        prompt = f"""
        You are assisting a recruiter with active candidate screening.
        
        TARGET JOB DETAILS:
        {job_profile_text}
        
        CANDIDATE DOSSIER / PROFILE:
        {candidate_profile_text}
        
        CONVERSATION HISTORY:
        {json.dumps(conversation_history, indent=2)}
        
        LATEST USER MESSAGE:
        {user_message}
        """

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RecruiterChatResponseSchema,
            system_instruction=(
                "You are an elite, human-like HR Copilot and recruiting advisor. Answer the recruiter's questions "
                "with professional, highly objective facts sourced directly from the candidate dossier or job details. "
                "If the dossier doesn't contain the answer to a question, state honestly that the information is not "
                "available and suggest what questions they should ask during the interview to verify. "
                "Always populate exact quotes in 'citations' when referencing credentials. "
                "Suggest 2-3 dynamic follow-up questions tailored to continue the conversation."
            ),
            temperature=0.5
        )

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=config
        )

        try:
            parsed_data = json.loads(response.text)
            return RecruiterChatResponseSchema(**parsed_data)
        except Exception as e:
            logger.error(f"Failed to parse recruiter chat schema response: {response.text}", exc_info=True)
            raise RuntimeError(f"Recruiter assistant conversational query failed: {str(e)}")
