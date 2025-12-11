# PromptHive Validator 🐝

<p align="center">
<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Honeybee.png" width="150" alt="Logo" >
</p>

<p align="center">
  <strong>The First "Vibe Coding" Assessment Platform for the AI Age.</strong><br/>
  <em>Quantifying the subjective art of Prompt Engineering using Multimodal AI Judges.</em>
</p>

</br>

## 🚀 Vision & Innovation

**PromptHive Validator** isn't just a testing tool; it's a paradigm shift in how we define and measure "AI Literacy." 

As we move from writing syntax (Coding) to guiding models (Vibe Coding), the way we hire must evolve. We are solving the "Black Box" problem of AI recruitment: **How do you objectively grade a candidate's ability to communicate with a Neural Network?**

---

## 🏆 Assessment Criteria Breakdown

### 1. Impact (40%): Solving a Real-World Crisis in AI Hiring
**The Problem:** 
Hiring for AI-centric roles (AI Artists, Prompt Engineers, AI-Augmented Developers) is currently broken. 
*   **Subjectivity:** Recruiters cannot grade "creativity" objectively.
*   **Scale:** Manually reviewing 500+ generated images is impossible.
*   **Bias:** Evaluations often depend on the recruiter's personal taste rather than the candidate's technical control over the model.

**The Solution:** 
PromptHive standardized this process. By using a **Reverse-Engineering Protocol**, we turn subjective art into objective data.
*   **Tangible Change:** Companies can now screen 1,000 candidates overnight without human intervention.
*   **Social Impact:** It democratizes opportunity. A candidate doesn't need a degree or a portfolio of paid work; they just need to prove they can "speak model." It validates soft skills (nuance, description, visual vocabulary) as hard, hireable metrics.

### 2. Technical Depth & Execution (30%): A Multimodal Reasoning Engine
This application is not a wrapper; it is a complex **Agentic Workflow** built on the **Google GenAI SDK**.

*   **Multimodal "Judge" Agent:** The core innovation is the `evaluateSimilarity` engine. We don't just compare pixel differences. We pass **four distinct inputs** into `gemini-2.5-flash`:
    1.  The Target Image (Visual Context)
    2.  The Candidate's Generated Image (Visual Context)
    3.  The Hidden Original Prompt (Ground Truth)
    4.  The Candidate's Prompt (Input Syntax)
    
    The model performs **Chain-of-Thought Reasoning** to output a structured JSON score (0-100) across three axes: *Visual Accuracy*, *Prompt Technique*, and *Creativity*.

*   **Real-Time Generation**: Utilizing `gemini-2.5-flash-image` for sub-second image generation, creating a "live coding" feel for image synthesis.
*   **Robust Architecture**: Built with **React 19**, **TypeScript**, and **IndexedDB** for a completely serverless, privacy-focused architecture that persists state locally without expensive backend infrastructure.

### 3. Creativity (20%): The "Turing Test" for Prompts
We leveraged Gemini in a way that wasn't previously possible: **Meta-Evaluation**.
*   **Novelty:** Instead of asking Gemini to *generate* content, we ask it to *critique* its own peers. This circular validation loop (AI generating -> Human prompting -> AI Judging) creates a self-correcting feedback system.
*   **Gamification**: We transformed a boring assessment into a high-stakes, Cyberpunk-styled "Heist" where candidates must "crack the code" of the latent space.
*   **Vibe Coding**: We are the first to productize the concept of "Vibe Coding"—where the syntax is English, and the compiler is a Large Multimodal Model.

### 4. Presentation Quality (10%): UX & Viral Potential
*   **Aesthetic**: A polished, "Dark Mode" Cyberpunk interface that appeals to the target demographic of AI engineers and creators.
*   **Feedback Loops**: Immediate visual feedback (Diff Pulse, Overlay Sliders) makes the "invisible" differences between images visible, educating the user instantly.
*   **Seamless Flow**: From the Admin generating unique challenges using AI, to the Candidate taking the test, to the detailed Analytics dashboard—the experience is frictionless.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **AI Models**: 
    *   **Judge Logic**: `gemini-2.5-flash` (Optimized for JSON reasoning)
    *   **Image Synthesis**: `gemini-2.5-flash-image` (High speed, reliable instruction following)
*   **State Management**: IndexedDB (via native API)
*   **Styling**: Tailwind CSS (Custom "Hive" Theme)
*   **Icons**: Lucide React

---

## 🔮 Future Scope

The "Vibe Coding" framework established here allows for massive scalability:

1.  **Video-to-Video Assessment**: Integrating Google's **Veo** model to test candidates on video prompting (e.g., "Make this character walk naturally").
2.  **Full-Stack Code Vibe Checks**: Assessing developers not on writing syntax, but on *guiding* coding agents to build bug-free apps.
3.  **Enterprise Integration**: Connecting with ATS (Applicant Tracking Systems) like Greenhouse or Lever to automatically send these assessments to applicants.
4.  **On-Chain Certification**: Minting "Prompt Engineering" credentials as NFTs/SBTs for candidates who pass "Expert" level protocols, creating a verified talent pool.

---

## 🏃 Installation Guide

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/prompthive-validator.git
    cd prompthive-validator
    ```
2.  **Install Dependencies**
    ```bash
    npm install
    ```
3.  **Set API Key**
    Create a `.env` file or set the key in your environment.
    ```bash
    export API_KEY="YOUR_GEMINI_API_KEY"
    ```
4.  **Run the application**
    ```bash
    npm run dev
    ```
5.  **Admin Login**
    *   Email: `admin@prompthive.com`
    *   (No password required for demo mode)

---

## 👨‍💻 Author Details
**Name**: Harshavardhan Bajoria
**Role**: Associate Product Manager @ Unstop
**Mission**: To build the tools that define the next generation of work.

