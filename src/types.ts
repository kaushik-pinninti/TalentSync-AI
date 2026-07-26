export interface Recruiter {
  id: number;
  email: string;
  name: string;
  company: string;
  created_at: string;
}

export interface Job {
  id: number;
  recruiter_id: number;
  title: string;
  description: string;
  experience: string;
  skills: string[];
  education: string;
  salary: string;
  location: string;
  employment_type: string; // "Full-time" | "Part-time" | "Contract" | "Remote"
  status: "active" | "archived";
  created_at: string;
}

export interface Candidate {
  id: number;
  job_id: number;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience_summary: string;
  education_summary: string;
  resume_text: string;
  file_name: string;
  cover_letter?: string;
  created_at: string;
  match?: MatchResult;
}

export interface MatchResult {
  id: number;
  candidate_id: number;
  overall_score: number;
  skills_match_score: number;
  experience_match_score: number;
  education_match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  summary: string;
  recommendation: string;
  explanation: string;
  detailed_analysis?: any;
  created_at: string;
}

export interface InterviewQuestionItem {
  question: string;
  type: "technical" | "behavioral" | "coding" | "system_design" | "project";
  expected_answer: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewQuestions {
  id: number;
  candidate_id: number;
  questions: InterviewQuestionItem[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface InterviewScorecard {
  overall_rating: number; // 1 to 5
  skills_rating: number; // 1 to 5
  experience_rating: number; // 1 to 5
  communication_rating: number; // 1 to 5
  culture_fit_rating: number; // 1 to 5
  strengths: string;
  weaknesses: string;
  recommendation: "hire" | "strong_hire" | "hold" | "reject";
  submitted_at: string;
}

export interface Interview {
  id: number;
  recruiter_id: number;
  candidate_id: number;
  job_id: number;
  title: string;
  datetime: string;
  duration: number; // in minutes
  interviewer_name: string;
  interviewer_email: string;
  platform: "google_meet" | "microsoft_teams" | "phone" | "in_person";
  meeting_link?: string;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  scorecard?: InterviewScorecard | null;
  created_at: string;
}

export interface InterviewNotification {
  id: number;
  interview_id: number;
  type: "scheduled" | "reminder" | "updated" | "cancelled" | "feedback_submitted";
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  status: "sent" | "failed";
}

