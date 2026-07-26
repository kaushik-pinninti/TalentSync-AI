import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardStats from "../components/DashboardStats";
import { Job, Candidate } from "../types";

// Mock recharts to avoid JSDOM SVG layout issues
vi.mock("recharts", () => {
  const MockComponent = ({ children, dataTestid }: any) => (
    <div data-testid={dataTestid || "mock-recharts"}>{children}</div>
  );
  return {
    ResponsiveContainer: ({ children }: any) => <MockComponent dataTestid="responsive-container">{children}</MockComponent>,
    AreaChart: ({ children }: any) => <MockComponent dataTestid="area-chart">{children}</MockComponent>,
    Area: () => <div data-testid="chart-area" />,
    BarChart: ({ children }: any) => <MockComponent dataTestid="bar-chart">{children}</MockComponent>,
    Bar: () => <div data-testid="chart-bar" />,
    XAxis: () => <div data-testid="chart-xaxis" />,
    YAxis: () => <div data-testid="chart-yaxis" />,
    CartesianGrid: () => <div data-testid="chart-grid" />,
    Tooltip: () => <div data-testid="chart-tooltip" />,
    Legend: () => <div data-testid="chart-legend" />,
    PieChart: ({ children }: any) => <MockComponent dataTestid="pie-chart">{children}</MockComponent>,
    Pie: () => <div data-testid="chart-pie" />,
    Cell: () => <div data-testid="chart-cell" />,
    LineChart: ({ children }: any) => <MockComponent dataTestid="line-chart">{children}</MockComponent>,
    Line: () => <div data-testid="chart-line" />,
    RadarChart: ({ children }: any) => <MockComponent dataTestid="radar-chart">{children}</MockComponent>,
    Radar: () => <div data-testid="chart-radar" />,
    PolarGrid: () => <div data-testid="chart-polar-grid" />,
    PolarAngleAxis: () => <div data-testid="chart-polar-angle" />,
    PolarRadiusAxis: () => <div data-testid="chart-polar-radius" />,
  };
});

// Mock fetch for interviews list
const mockInterviews = {
  interviews: [
    {
      id: 1,
      candidate_id: 101,
      job_id: 10,
      title: "Technical Interview",
      status: "completed",
      scorecard: {
        recommendation: "strong_hire",
        overall_rating: 5,
      },
    },
  ],
};

global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockInterviews),
  })
) as any;

describe("DashboardStats Component", () => {
  const mockJobs: Job[] = [
    {
      id: 10,
      recruiter_id: 1,
      title: "Senior React Developer",
      description: "Build interfaces",
      experience: "5 years",
      skills: ["React", "TypeScript", "Tailwind"],
      education: "BSCS",
      salary: "$120,000",
      location: "San Francisco",
      employment_type: "Full-time",
      status: "active",
      created_at: new Date().toISOString(),
    },
    {
      id: 11,
      recruiter_id: 1,
      title: "Product Manager",
      description: "Manage product roadmap",
      experience: "3 years",
      skills: ["Agile", "Scrum"],
      education: "MBA",
      salary: "$110,000",
      location: "Remote",
      employment_type: "Remote",
      status: "active",
      created_at: new Date().toISOString(),
    },
  ];

  const mockCandidates: Candidate[] = [
    {
      id: 101,
      job_id: 10,
      name: "John Doe",
      email: "john@example.com",
      phone: "123-456-7890",
      skills: ["React", "TypeScript"],
      experience_summary: "Worked on UI",
      education_summary: "BS in Computer Science",
      resume_text: "Resume context...",
      file_name: "john_resume.pdf",
      created_at: new Date().toISOString(),
      match: {
        id: 50,
        candidate_id: 101,
        overall_score: 85,
        skills_match_score: 90,
        experience_match_score: 80,
        education_match_score: 85,
        matched_skills: ["React", "TypeScript"],
        missing_skills: ["Tailwind"],
        summary: "Good fit",
        recommendation: "Hire",
        explanation: "Matches profile",
        created_at: new Date().toISOString(),
      },
    },
    {
      id: 102,
      job_id: 11,
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "987-654-3210",
      skills: ["Agile"],
      experience_summary: "Managed backlog",
      education_summary: "MBA",
      resume_text: "Resume context 2...",
      file_name: "jane_resume.pdf",
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("ts_token", "test-token");
  });

  it("renders main dashboard analytics panels", async () => {
    render(<DashboardStats jobs={mockJobs} candidates={mockCandidates} />);

    // Check key statistic panels are displayed
    expect(screen.getByText(/Total Applicants Sourced/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg Time to Hire/i)).toBeInTheDocument();
    expect(screen.getByText(/Offer Acceptance Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Automation ROI/i)).toBeInTheDocument();

    // Verify correct counts
    const applicantsCard = screen.getByText(/Total Applicants Sourced/i).closest(".bg-white");
    expect(applicantsCard).toBeInTheDocument();
    expect(applicantsCard!.querySelector("h3")).toHaveTextContent("2");
  });

  it("updates metrics and counts when filtering by job selection", async () => {
    const { container } = render(<DashboardStats jobs={mockJobs} candidates={mockCandidates} />);

    const jobSelect = container.querySelector("#filter-job-id");
    expect(jobSelect).toBeInTheDocument();

    // Change to Senior React Developer (ID: 10)
    fireEvent.change(jobSelect!, { target: { value: "10" } });

    // The overview metrics should be updated for the specific job
    // Target the specific KPI card for "Total Applicants Sourced" to verify its count updates to 1
    const applicantsCard = screen.getByText(/Total Applicants Sourced/i).closest(".bg-white");
    expect(applicantsCard).toBeInTheDocument();
    const countElement = applicantsCard!.querySelector("h3");
    expect(countElement).toHaveTextContent("1");
  });

  it("switches tabs between overview, funnel, skills and productivity", async () => {
    const { container } = render(<DashboardStats jobs={mockJobs} candidates={mockCandidates} />);

    // Verify we are on Overview tab initially
    expect(screen.getByText(/Monthly Recruitment Flow/i)).toBeInTheDocument();

    // Find and click the Skills Distribution tab by ID
    const skillsTabButton = container.querySelector("#tab-analytics-skills");
    expect(skillsTabButton).toBeInTheDocument();
    fireEvent.click(skillsTabButton!);

    // Verify skills related details are rendered
    expect(screen.getByText(/Candidate Skill Frequency Radar/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Extractable Competencies/i)).toBeInTheDocument();

    // Find and click the Productivity tab by ID
    const productivityTabButton = container.querySelector("#tab-analytics-productivity");
    expect(productivityTabButton).toBeInTheDocument();
    fireEvent.click(productivityTabButton!);

    expect(screen.getByText(/Recruiting Officer Throughput/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Automation ROI & Usage/i)).toBeInTheDocument();
  });

  it("handles empty candidates or jobs lists gracefully", () => {
    render(<DashboardStats jobs={[]} candidates={[]} />);
    const applicantsCard = screen.getByText(/Total Applicants Sourced/i).closest(".bg-white");
    expect(applicantsCard).toBeInTheDocument();
    expect(applicantsCard!.querySelector("h3")).toHaveTextContent("0");
  });
});
