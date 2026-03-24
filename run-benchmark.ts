import OpenAI from 'openai';

const TOKEN_ZIP_URL = 'http://localhost:3000/v1/chat/completions';
const DIRECT_BASE_URL = process.env.DIRECT_BASE_URL || 'REDACTED_BASE_URL';
const DIRECT_API_KEY = process.env.DIRECT_API_KEY || 'REDACTED_API_KEY';
const DIRECT_MODEL = process.env.DIRECT_MODEL || 'claude-opus-4-6';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10);

interface TestCase {
  name: string;
  category: string;
  messages: { role: string; content: string }[];
}

const TEST_CASES: TestCase[] = [
  // ── Programming (5) ──
  { name: 'B+ Tree Explanation', category: 'Programming', messages: [{ role: 'user', content: 'Explain how a B+ tree works in databases, including its structure, insertion, deletion, and why it is preferred over binary search trees for disk-based storage. Include pseudocode for the search operation.' }] },
  { name: 'Memory Leak Debugging', category: 'Programming', messages: [{ role: 'system', content: 'You are an expert Node.js developer.' }, { role: 'user', content: 'Our Express.js API has a memory leak. RSS grows from 200MB to 2GB over 24 hours under load (>100 req/s). We use pg-pool, ioredis, Winston with daily rotate, and Multer for S3 uploads on Kubernetes (4GB limit). What systematic approach would you use to identify and fix this?' }] },
  { name: 'Code Refactoring', category: 'Programming', messages: [{ role: 'user', content: 'Refactor this JavaScript into clean TypeScript with SOLID principles:\n\nfunction processOrder(order, user, inventory, mailer, logger) {\n  if (!order) return { error: "no order" };\n  let total = 0;\n  for (let i = 0; i < order.items.length; i++) {\n    let item = order.items[i];\n    if (inventory.check(item.productId) < item.quantity) return { error: "out of stock" };\n    total += item.price * item.quantity * (item.discount ? (1 - item.discount/100) : 1);\n  }\n  if (user.membership === "gold") total *= 0.9;\n  if (user.membership === "platinum") total *= 0.85;\n  let tax = total * 0.08;\n  total += tax;\n  for (let i = 0; i < order.items.length; i++) inventory.reduce(order.items[i].productId, order.items[i].quantity);\n  let result = db.saveOrder({ userId: user.id, items: order.items, total, tax, status: "confirmed" });\n  mailer.send(user.email, "Order Confirmed", "Total: $" + total.toFixed(2));\n  return { success: true, orderId: result.id, total };\n}\n\nExplain each refactoring decision.' }] },
  { name: 'Sorting Algorithms', category: 'Programming', messages: [{ role: 'user', content: 'Compare quicksort, mergesort, heapsort, and timsort in detail. For each: explain the algorithm, time/space complexity for best/average/worst cases, stability, cache performance, and real-world usage. Which would you recommend for different scenarios?' }] },
  { name: 'Security Audit', category: 'Programming', messages: [{ role: 'user', content: 'Perform a security audit of this Node.js login code and identify all vulnerabilities:\n\napp.post("/login", (req, res) => {\n  const { username, password } = req.body;\n  const user = db.query(`SELECT * FROM users WHERE username = \'${username}\'`);\n  if (user && user.password === password) {\n    const token = jwt.sign({ id: user.id, role: user.role }, "my-secret-key");\n    res.cookie("token", token);\n    res.json({ success: true, token });\n  } else {\n    res.json({ success: false, message: "Invalid credentials" });\n  }\n});\n\nList each vulnerability, explain the risk, and provide corrected code.' }] },

  // ── Architecture & DevOps (4) ──
  { name: 'URL Shortener Design', category: 'Architecture', messages: [{ role: 'user', content: 'Design a URL shortener like bit.ly handling 100M URLs/day. Cover API design, database schema, hashing strategy, caching, analytics (click tracking, geo distribution), and consistency vs availability trade-offs.' }] },
  { name: 'API Design Review', category: 'Architecture', messages: [{ role: 'user', content: 'Review this REST API design for a social media platform and suggest improvements:\n\nPOST /createUser\nGET /getUser?id=123\nPOST /updateUser\nDELETE /removeUser?id=123\nGET /getUserPosts?userId=123&page=1\nPOST /createPost\nPOST /likePost\n\nCover naming conventions, HTTP methods, error handling, pagination, versioning, auth, and rate limiting. Provide the corrected design.' }] },
  { name: 'CI/CD Pipeline', category: 'DevOps', messages: [{ role: 'user', content: 'Design a complete CI/CD pipeline for a microservices app with 12 services (React frontend, 8 Go services, 2 Python ML services, 1 Rust service). Cover: branching strategy, build stages, testing, container builds, security scanning, staging deployment, canary releases, rollback, and monitoring.' }] },
  { name: 'Database Optimization', category: 'Architecture', messages: [{ role: 'user', content: 'Our PostgreSQL orders table has 500M rows. Common queries: orders by customer_id (last 30 days), daily revenue aggregation, status+date range search, and order+items join for invoices. Explain your optimization strategy: indexing, partitioning, query rewriting, materialized views, and connection pooling.' }] },

  // ── Business & Strategy (6) ──
  { name: 'Market Entry Strategy', category: 'Business', messages: [{ role: 'user', content: 'A mid-sized European SaaS company ($50M ARR) wants to enter the Southeast Asian market. They sell B2B project management software. Develop a comprehensive market entry strategy covering: market analysis (which countries first and why), localization requirements, pricing strategy, distribution channels, partnership approach, regulatory considerations, and a 24-month execution timeline with KPIs.' }] },
  { name: 'Startup Pitch Deck', category: 'Business', messages: [{ role: 'user', content: 'Help me structure a pitch deck for a Series A fundraise. Our startup is an AI-powered legal document review platform. We have $2M ARR, 50 law firm customers, 3x YoY growth, and are raising $15M at $75M pre-money. Outline each slide with key talking points, what data to include, and common investor questions to prepare for.' }] },
  { name: 'Competitive Analysis', category: 'Business', messages: [{ role: 'user', content: 'Conduct a competitive analysis of the cloud infrastructure market. Compare AWS, Azure, GCP, and emerging players like Cloudflare and Vercel. Cover: market share, pricing models, unique differentiators, target customer segments, recent strategic moves, strengths/weaknesses, and where each is likely to focus in the next 3 years.' }] },
  { name: 'Business Model Canvas', category: 'Business', messages: [{ role: 'user', content: 'Create a detailed Business Model Canvas for an online education platform focused on professional upskilling in AI/ML. Cover all 9 blocks: customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure. Include specific examples and metrics for each.' }] },
  { name: 'M&A Due Diligence', category: 'Business', messages: [{ role: 'user', content: 'Our company ($200M revenue, fintech) is considering acquiring a smaller competitor ($30M revenue). Outline a comprehensive due diligence framework covering: financial analysis, technology assessment, customer overlap analysis, regulatory compliance review, cultural fit evaluation, integration risks, and valuation methodology. What are the top 10 deal-breakers to watch for?' }] },
  { name: 'OKR Framework', category: 'Business', messages: [{ role: 'user', content: 'Design a comprehensive OKR framework for a 500-person technology company transitioning from annual planning to quarterly OKRs. Cover: how to cascade company-level OKRs to team and individual level, scoring methodology, review cadence, common pitfalls, tools for tracking, and how to handle cross-functional dependencies. Provide example OKRs for the CEO, VP of Engineering, VP of Sales, and VP of Product.' }] },

  // ── Finance & Economics (5) ──
  { name: 'Portfolio Theory', category: 'Finance', messages: [{ role: 'user', content: 'Explain Modern Portfolio Theory (MPT) in depth. Cover: efficient frontier, capital market line, Sharpe ratio, diversification benefits, the role of correlation, limitations of MPT, and how the Black-Litterman model addresses some of these limitations. Include mathematical formulations and a practical example of constructing an optimal portfolio with 5 asset classes.' }] },
  { name: 'Options Pricing', category: 'Finance', messages: [{ role: 'user', content: 'Explain options pricing theory comprehensively. Cover the Black-Scholes model (assumptions, derivation intuition, formula), the Greeks (delta, gamma, theta, vega, rho) with practical interpretations, binomial tree model, implied volatility and the volatility smile, and how market makers use these concepts. Include numerical examples.' }] },
  { name: 'Monetary Policy', category: 'Economics', messages: [{ role: 'user', content: 'Analyze how central bank monetary policy affects different asset classes. Cover: interest rate transmission mechanism, quantitative easing vs tightening effects on bonds/equities/real estate/currencies/commodities, the yield curve as an economic indicator, how forward guidance works, and the limitations of monetary policy (liquidity trap, zero lower bound). Use examples from the Fed, ECB, and BOJ.' }] },
  { name: 'Financial Statement Analysis', category: 'Finance', messages: [{ role: 'user', content: 'Teach me how to analyze a company\'s financial health using its three financial statements. Cover: key ratios (liquidity, profitability, leverage, efficiency), DuPont analysis, cash flow analysis, red flags to watch for, how to compare across industries, and what financial statements cannot tell you. Use a hypothetical SaaS company as an example throughout.' }] },
  { name: 'Cryptocurrency Economics', category: 'Finance', messages: [{ role: 'user', content: 'Analyze the economic model of Ethereum post-merge. Cover: the transition from PoW to PoS, tokenomics (issuance rate, burn mechanism via EIP-1559, net deflation conditions), staking economics (validator rewards, slashing risks, liquid staking), MEV and its impact, and L2 economics (how rollups affect gas demand). Compare with Bitcoin\'s economic model.' }] },

  // ── Science & Technology (5) ──
  { name: 'Quantum Computing', category: 'Science', messages: [{ role: 'user', content: 'Explain quantum computing for someone with a physics undergraduate background. Cover: qubits vs classical bits, superposition and entanglement, quantum gates (Hadamard, CNOT, Toffoli), quantum circuits, Shor\'s algorithm (high-level), Grover\'s algorithm, quantum error correction basics, current hardware approaches (superconducting, trapped ion, photonic), and realistic timeline for practical quantum advantage.' }] },
  { name: 'Climate Science', category: 'Science', messages: [{ role: 'user', content: 'Explain the science of climate change comprehensively. Cover: the greenhouse effect mechanism, key greenhouse gases and their sources, carbon cycle and feedback loops (ice-albedo, water vapor, permafrost methane), ocean acidification, climate modeling approaches and their uncertainties, observed changes vs predictions, tipping points, and the current state of mitigation technologies (CCS, direct air capture, enhanced weathering).' }] },
  { name: 'CRISPR Gene Editing', category: 'Science', messages: [{ role: 'user', content: 'Explain CRISPR-Cas9 gene editing technology in depth. Cover: the biological mechanism (guide RNA, Cas9 protein, DNA repair pathways), how it compares to earlier gene editing tools (ZFNs, TALENs), current medical applications (sickle cell, cancer immunotherapy), agricultural applications, ethical considerations (germline editing, designer babies debate), regulatory landscape across countries, and emerging next-gen tools (base editing, prime editing).' }] },
  { name: 'Rocket Propulsion', category: 'Science', messages: [{ role: 'user', content: 'Explain rocket propulsion systems. Cover: the Tsiolkovsky rocket equation, types of chemical propulsion (solid, liquid bipropellant, hypergolic), specific impulse and how it\'s measured, staging strategies, electric propulsion (ion, Hall thruster), nuclear thermal propulsion concepts, and how SpaceX\'s Raptor full-flow staged combustion cycle works compared to traditional engines.' }] },
  { name: 'Neuroscience of Memory', category: 'Science', messages: [{ role: 'user', content: 'Explain how human memory works from a neuroscience perspective. Cover: sensory memory, working memory (Baddeley\'s model), long-term memory types (episodic, semantic, procedural), the role of the hippocampus in consolidation, synaptic plasticity (LTP and LTD), molecular mechanisms (CREB, protein synthesis), sleep and memory consolidation, age-related memory decline, and current research on memory enhancement.' }] },

  // ── Education & Learning (4) ──
  { name: 'Curriculum Design', category: 'Education', messages: [{ role: 'user', content: 'Design a 12-week data science bootcamp curriculum for career changers with basic Python knowledge. For each week, specify: learning objectives, topics, hands-on projects, assessment methods, and recommended resources. Cover: statistics, pandas/numpy, visualization, machine learning (supervised/unsupervised), deep learning basics, SQL, and a capstone project. Explain your pedagogical approach.' }] },
  { name: 'Learning Science', category: 'Education', messages: [{ role: 'user', content: 'Explain the science of effective learning based on cognitive psychology research. Cover: spaced repetition (Ebbinghaus curve), active recall vs passive review, interleaving, elaborative interrogation, the testing effect, dual coding theory, cognitive load theory, growth mindset research (Dweck), deliberate practice (Ericsson), and metacognition. For each technique, provide practical implementation advice for a university student.' }] },
  { name: 'Teaching Philosophy', category: 'Education', messages: [{ role: 'user', content: 'Compare major educational philosophies and their practical implications: constructivism (Piaget, Vygotsky), behaviorism (Skinner), connectivism (Siemens), experiential learning (Kolb), and inquiry-based learning. For each, explain the core theory, classroom implementation strategies, assessment approaches, strengths and criticisms, and which subjects/age groups it works best for.' }] },
  { name: 'Online Course Design', category: 'Education', messages: [{ role: 'user', content: 'I want to create an online course on personal finance for young adults (22-35). Help me design it: course structure (modules and lessons), engagement strategies to reduce drop-off, assessment design, video production tips, community building approaches, pricing strategy (freemium vs paid vs subscription), marketing channels, and platform selection (Udemy vs Teachable vs self-hosted). Target is 2000 students in year one.' }] },

  // ── Healthcare & Medicine (4) ──
  { name: 'Clinical Trial Design', category: 'Healthcare', messages: [{ role: 'user', content: 'Explain how to design a Phase III clinical trial for a new oral diabetes medication. Cover: study design (RCT, double-blind, placebo-controlled), sample size calculation, inclusion/exclusion criteria, primary and secondary endpoints, statistical analysis plan (superiority vs non-inferiority), interim analysis and data monitoring, regulatory requirements (FDA vs EMA), patient recruitment strategies, and common pitfalls that lead to trial failure.' }] },
  { name: 'Healthcare AI Ethics', category: 'Healthcare', messages: [{ role: 'user', content: 'Analyze the ethical challenges of deploying AI in healthcare. Cover: algorithmic bias in medical imaging and diagnosis, data privacy (HIPAA, GDPR), informed consent for AI-assisted decisions, liability when AI makes errors, the black box problem in clinical settings, health equity concerns, the role of human oversight, regulatory frameworks (FDA SaMD guidance), and best practices for responsible AI deployment in hospitals.' }] },
  { name: 'Epidemiology Basics', category: 'Healthcare', messages: [{ role: 'user', content: 'Explain key epidemiological concepts and study designs. Cover: incidence vs prevalence, relative risk vs odds ratio, study types (cohort, case-control, cross-sectional, RCT), bias types (selection, information, confounding), measures of association, number needed to treat (NNT), screening test metrics (sensitivity, specificity, PPV, NPV), and how to critically appraise a published epidemiological study. Use real-world disease examples.' }] },
  { name: 'Mental Health Treatment', category: 'Healthcare', messages: [{ role: 'user', content: 'Compare evidence-based treatments for major depressive disorder. Cover: pharmacotherapy (SSRIs, SNRIs, atypicals, MAOIs - mechanisms, efficacy, side effects), psychotherapy approaches (CBT, IPT, psychodynamic, MBCT - evidence base for each), combination therapy, treatment-resistant depression options (ketamine/esketamine, TMS, ECT), the role of exercise and lifestyle interventions, and how to create a stepped-care treatment algorithm.' }] },

  // ── Law & Policy (4) ──
  { name: 'AI Regulation', category: 'Law', messages: [{ role: 'user', content: 'Compare the major AI regulatory frameworks worldwide. Cover: the EU AI Act (risk categories, requirements, penalties), US approach (executive orders, sector-specific regulation, state laws), China\'s AI regulations (algorithm recommendation rules, generative AI rules, deepfake laws), UK\'s pro-innovation approach, and international coordination efforts. Analyze the impact on AI companies and recommend a compliance strategy for a startup operating globally.' }] },
  { name: 'IP Strategy', category: 'Law', messages: [{ role: 'user', content: 'Develop an intellectual property strategy for a technology startup. Cover: when to patent vs trade secret, patent filing strategy (provisional, PCT, national phase), open source licensing considerations (MIT, Apache, GPL - implications for business model), trademark protection for brand and product names, copyright for code and content, trade secret protection practices, IP due diligence for fundraising, and how to handle IP created by contractors and employees.' }] },
  { name: 'Data Privacy Compliance', category: 'Law', messages: [{ role: 'user', content: 'Create a comprehensive data privacy compliance guide for a SaaS company operating in the US, EU, and Asia. Cover: GDPR requirements (lawful basis, DPIA, DPO, cross-border transfers), CCPA/CPRA compliance, PIPL (China), APPI (Japan), PDPA (Singapore/Thailand), data breach notification requirements across jurisdictions, practical steps for compliance (data mapping, privacy by design, vendor management), and common mistakes companies make.' }] },
  { name: 'Employment Law', category: 'Law', messages: [{ role: 'user', content: 'Explain key employment law considerations for a growing US tech company (50-500 employees). Cover: at-will employment and its exceptions, anti-discrimination laws (Title VII, ADA, ADEA), wage and hour compliance (FLSA, exempt vs non-exempt), family leave (FMLA), workplace safety (OSHA), employee vs contractor classification, non-compete and NDA enforceability trends, remote work legal considerations, and the top 10 HR compliance mistakes that lead to lawsuits.' }] },

  // ── Marketing & Communications (4) ──
  { name: 'Content Strategy', category: 'Marketing', messages: [{ role: 'user', content: 'Develop a comprehensive content marketing strategy for a B2B cybersecurity company targeting enterprise CISOs. Cover: buyer persona development, content pillars and topic clusters, content types for each funnel stage (awareness, consideration, decision), SEO strategy, distribution channels, thought leadership approach, content calendar framework, measurement and KPIs, team structure, and budget allocation. Provide a 6-month content roadmap.' }] },
  { name: 'Brand Positioning', category: 'Marketing', messages: [{ role: 'user', content: 'A new electric vehicle startup wants to differentiate from Tesla, BYD, and Rivian. They focus on affordable compact EVs for urban commuters ($20-30K range). Develop their brand positioning: target audience profiles, brand archetype, positioning statement, messaging hierarchy, visual identity direction, tone of voice guide, competitor positioning map, and launch campaign concept with channel strategy.' }] },
  { name: 'Crisis Communication', category: 'Marketing', messages: [{ role: 'user', content: 'A major food company discovers contamination in one product line affecting 3 states. No hospitalizations yet but social media is picking up reports of illness. Develop a crisis communication plan: immediate actions (first 24 hours), stakeholder communication matrix, media response strategy, social media management, internal communications, regulatory notification, consumer hotline scripts, recovery strategy, and lessons-learned framework. Include sample press release and holding statements.' }] },
  { name: 'Product Launch Plan', category: 'Marketing', messages: [{ role: 'user', content: 'Plan the launch of a new project management tool targeting remote-first teams (50-500 people). The tool integrates AI for task prioritization and workload balancing. Cover: pre-launch activities (beta program, influencer seeding, waitlist strategy), launch day execution, PR strategy, product-led growth mechanisms, pricing and packaging (free tier, pro, enterprise), onboarding optimization, partnership strategy, and 90-day post-launch metrics to track.' }] },

  // ── Philosophy & Ethics (3) ──
  { name: 'Ethics of AI', category: 'Philosophy', messages: [{ role: 'user', content: 'Analyze the philosophical implications of artificial general intelligence. Cover: the alignment problem (Bostrom, Russell), consciousness and moral status of AI, the control problem, existential risk arguments, economic displacement and distributive justice, autonomy and human dignity, the value alignment problem, arguments for and against AI development pause, and how different ethical frameworks (utilitarian, deontological, virtue ethics) evaluate AGI development.' }] },
  { name: 'Free Will Debate', category: 'Philosophy', messages: [{ role: 'user', content: 'Present the philosophical debate on free will. Cover the major positions: hard determinism (Spinoza, d\'Holbach), libertarian free will (Kane, Chisholm), compatibilism (Frankfurt, Dennett), and hard incompatibilism (Pereboom). For each: state the core argument, key thought experiments (Frankfurt cases, Libet experiments, manipulation arguments), implications for moral responsibility, and the strongest objections. Which position do neuroscience findings support?' }] },
  { name: 'Justice Theory', category: 'Philosophy', messages: [{ role: 'user', content: 'Compare major theories of justice. Cover: Rawls\' justice as fairness (original position, veil of ignorance, two principles), Nozick\'s libertarian entitlement theory, Sen\'s capability approach, Walzer\'s spheres of justice, and communitarianism (Sandel, MacIntyre). For each, explain the core framework, practical policy implications, strongest critiques, and how it addresses contemporary issues like wealth inequality and climate justice.' }] },

  // ── History & Social Science (4) ──
  { name: 'Industrial Revolution', category: 'History', messages: [{ role: 'user', content: 'Analyze the causes and consequences of the Industrial Revolution. Cover: pre-conditions in 18th century Britain (agricultural revolution, capital accumulation, institutional factors), key technological innovations and their interconnections, the factory system and urbanization, social consequences (class formation, labor conditions, demographic transition), environmental impact, how it spread globally, and parallels with the current AI revolution.' }] },
  { name: 'Cold War Analysis', category: 'History', messages: [{ role: 'user', content: 'Analyze the Cold War as a geopolitical phenomenon. Cover: origins (ideological roots, post-WWII power vacuum, Kennan\'s Long Telegram), key crises (Berlin, Korea, Cuba, Vietnam), the role of nuclear deterrence (MAD doctrine), proxy wars and their legacy, economic competition (planned vs market economies), the arms race and its technological spillovers, détente and its collapse, and the factors that led to the Soviet Union\'s dissolution. What lessons apply to current US-China competition?' }] },
  { name: 'Behavioral Economics', category: 'Social Science', messages: [{ role: 'user', content: 'Explain the major findings of behavioral economics that challenge traditional economic assumptions. Cover: prospect theory (Kahneman & Tversky), anchoring, framing effects, endowment effect, status quo bias, hyperbolic discounting, herd behavior, overconfidence, the planning fallacy, and nudge theory (Thaler & Sunstein). For each, explain the finding, experimental evidence, real-world implications, and how policymakers or businesses can apply it. Include critique from traditional economists.' }] },
  { name: 'Urbanization Trends', category: 'Social Science', messages: [{ role: 'user', content: 'Analyze global urbanization trends and their implications. Cover: historical urbanization patterns, the rise of megacities, smart city technologies and their limitations, urban planning challenges (housing, transportation, infrastructure), the urban heat island effect, gentrification dynamics, suburban vs urban living trade-offs, remote work\'s impact on urban centers, and urban policy innovations from cities like Singapore, Copenhagen, and Medellín.' }] },

  // ── Creative & Communications (4) ──
  { name: 'Storytelling Framework', category: 'Creative', messages: [{ role: 'user', content: 'Explain the major storytelling frameworks used in film, literature, and business. Cover: the Hero\'s Journey (Campbell/Vogler), three-act structure, Save the Cat beats, Pixar\'s storytelling rules, Dan Harmon\'s Story Circle, Freytag\'s Pyramid, and the Kishōtenketsu structure. For each, explain the framework, provide examples from well-known stories, and discuss how it can be adapted for business presentations and marketing narratives.' }] },
  { name: 'Public Speaking', category: 'Creative', messages: [{ role: 'user', content: 'Create a comprehensive guide to delivering high-impact presentations. Cover: audience analysis, message architecture (pyramid principle, rule of three), opening techniques that hook attention, data visualization best practices, storytelling in presentations, slide design principles (Duarte method), managing Q&A, handling nervousness (cognitive reappraisal, power posing research), voice and body language techniques, and how TED speakers structure their talks. Include a checklist for preparing a 20-minute conference talk.' }] },
  { name: 'Negotiation Strategy', category: 'Creative', messages: [{ role: 'user', content: 'Teach advanced negotiation strategies based on research. Cover: BATNA analysis (Fisher & Ury), integrative vs distributive bargaining, anchoring tactics, the power of silence, ZOPA identification, principled negotiation, emotional intelligence in negotiation, cultural differences in negotiation styles (Western vs Asian vs Middle Eastern), multi-party negotiations, and hostage negotiation techniques adapted for business (Chris Voss methods). Provide a framework for preparing for a salary negotiation and a major vendor contract negotiation.' }] },
  { name: 'Technical Documentation', category: 'Creative', messages: [{ role: 'user', content: 'Write a guide on creating world-class technical documentation. Cover: audience analysis (developers vs end-users vs administrators), documentation types (tutorials, how-tos, reference, explanation - Diátaxis framework), writing style guides (Microsoft, Google), API documentation best practices (OpenAPI, examples-first approach), documentation-as-code workflows, versioning strategies, internationalization, measuring documentation quality, and tools comparison (Docusaurus, GitBook, ReadTheDocs, Mintlify). Include examples of companies with excellent docs.' }] },

  // ── Mathematics & CS Theory (3) ──
  { name: 'Harmonic Series Proof', category: 'Mathematics', messages: [{ role: 'user', content: 'Prove that the harmonic series diverges using at least three different methods. For each proof, explain the intuition, provide the formal argument, and discuss historical significance. Then derive the approximation H_n ≈ ln(n) + γ where γ is the Euler-Mascheroni constant.' }] },
  { name: 'Concurrency Patterns', category: 'CS Theory', messages: [{ role: 'user', content: 'Explain major concurrency patterns: mutexes, semaphores, read-write locks, channels (CSP), actor model, and software transactional memory. For each, describe the mechanism, provide a use case, discuss pros/cons, and show which languages favor it. Compare them in a table and recommend which to use for: a web server, a game engine, a data pipeline, and a GUI application.' }] },
  { name: 'Graph Theory Applications', category: 'Mathematics', messages: [{ role: 'user', content: 'Explain practical applications of graph theory in modern technology. Cover: social network analysis (PageRank, community detection, influence maximization), recommendation systems (collaborative filtering as bipartite graphs), network routing (Dijkstra, Bellman-Ford, BGP), knowledge graphs, dependency resolution (topological sort), circuit design, and transportation optimization. For each application, explain the graph model and the algorithm used.' }] },
];

const directClient = new OpenAI({
  apiKey: DIRECT_API_KEY,
  baseURL: DIRECT_BASE_URL,
});

interface Result {
  name: string;
  category: string;
  direct: { inputTokens: number; outputTokens: number; elapsed: number };
  zip: {
    inputTokens: number; outputTokens: number; elapsed: number;
    originalInputTokens: number; originalOutputTokens: number;
    inputCompressionRatio: number; outputCompressionRatio: number;
    costWithoutZip: number; costWithZip: number;
    savingsUSD: number; savingsPct: number;
  };
  quality: { directScore: number; zipScore: number; reasoning: string };
}

async function callDirect(tc: TestCase) {
  const start = Date.now();
  const resp = await directClient.chat.completions.create({
    model: DIRECT_MODEL, messages: tc.messages as any, max_tokens: 4096,
  });
  return {
    content: resp.choices[0]?.message?.content || '',
    inputTokens: resp.usage?.prompt_tokens || 0,
    outputTokens: resp.usage?.completion_tokens || 0,
    elapsed: Date.now() - start,
  };
}

async function callTokenZip(tc: TestCase) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
  try {
    const resp = await fetch(TOKEN_ZIP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: tc.messages, max_tokens: 4096 }),
      signal: controller.signal,
    });
    const data = await resp.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      stats: data.token_zip_stats,
      elapsed: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function judgeQuality(
  question: string, directAnswer: string, zipAnswer: string,
): Promise<{ directScore: number; zipScore: number; reasoning: string }> {
  const resp = await directClient.chat.completions.create({
    model: 'claude-sonnet-4-6', max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are an impartial judge. Rate two answers (A and B) to the same question on a scale of 1-10. Consider accuracy, completeness, clarity, and usefulness.

QUESTION:
${question.slice(0, 1000)}

ANSWER A (Direct):
${directAnswer.slice(0, 2000)}

ANSWER B (Token-Zip):
${zipAnswer.slice(0, 2000)}

Respond in JSON only: {"directScore": <number>, "zipScore": <number>, "reasoning": "<one sentence>"}`,
    }],
  });
  try {
    const match = (resp.choices[0]?.message?.content || '').match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return { directScore: 0, zipScore: 0, reasoning: 'Parse failed' };
}

async function runOne(tc: TestCase, idx: number, retries = 2): Promise<Result> {
  const label = `[${idx + 1}/${TEST_CASES.length}] ${tc.name}`;
  console.log(`${label} — starting`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const direct = await callDirect(tc);
      console.log(`${label} — direct done (${direct.elapsed}ms)`);

      const zip = await callTokenZip(tc);
      console.log(`${label} — zip done (${zip.elapsed}ms, saved ${zip.stats?.savings?.percentage ?? '?'}%)`);

      const userQ = tc.messages.find(m => m.role === 'user')?.content || '';
      const judge = await judgeQuality(userQ, direct.content, zip.content);
      console.log(`${label} — judged: Direct=${judge.directScore} Zip=${judge.zipScore}`);

      return {
        name: tc.name, category: tc.category,
        direct: { inputTokens: direct.inputTokens, outputTokens: direct.outputTokens, elapsed: direct.elapsed },
        zip: {
          inputTokens: zip.stats?.compressedInputTokens || 0,
          outputTokens: zip.stats?.compressedOutputTokens || 0,
          elapsed: zip.elapsed,
          originalInputTokens: zip.stats?.originalInputTokens || 0,
          originalOutputTokens: zip.stats?.originalOutputTokens || 0,
          inputCompressionRatio: zip.stats?.inputCompressionRatio || 0,
          outputCompressionRatio: zip.stats?.outputCompressionRatio || 0,
          costWithoutZip: zip.stats?.costWithoutZip?.amountUSD || 0,
          costWithZip: zip.stats?.costWithZip?.amountUSD || 0,
          savingsUSD: zip.stats?.savings?.amountUSD || 0,
          savingsPct: zip.stats?.savings?.percentage || 0,
        },
        quality: judge,
      };
    } catch (err: any) {
      console.error(`${label} — attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt === retries) {
        console.error(`${label} — all retries exhausted, returning fallback`);
        return {
          name: tc.name, category: tc.category,
          direct: { inputTokens: 0, outputTokens: 0, elapsed: 0 },
          zip: { inputTokens: 0, outputTokens: 0, elapsed: 0, originalInputTokens: 0, originalOutputTokens: 0, inputCompressionRatio: 0, outputCompressionRatio: 0, costWithoutZip: 0, costWithZip: 0, savingsUSD: 0, savingsPct: 0 },
          quality: { directScore: 0, zipScore: 0, reasoning: `Failed: ${err.message}` },
        };
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  throw new Error('unreachable');
}

async function runBatch(tasks: { tc: TestCase; idx: number }[]): Promise<Result[]> {
  return Promise.all(tasks.map(t => runOne(t.tc, t.idx)));
}

async function main() {
  console.log('Token-Zip Benchmark');
  console.log('='.repeat(80));
  console.log(`Target model:   ${DIRECT_MODEL}`);
  console.log(`Compress model: kimi-k2.5`);
  console.log(`Judge model:    claude-sonnet-4-6`);
  console.log(`Test cases:     ${TEST_CASES.length}`);
  console.log(`Concurrency:    ${CONCURRENCY}`);
  console.log('='.repeat(80));
  console.log();

  const startIdx = parseInt(process.env.START_INDEX || '0', 10);
  const results: Result[] = [];
  const queue = TEST_CASES.slice(startIdx).map((tc, i) => ({ tc, idx: startIdx + i }));

  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    const batchResults = await runBatch(batch);
    results.push(...batchResults);
    console.log(`--- ${results.length}/${TEST_CASES.length} completed ---\n`);
  }

  // Sort by original order
  results.sort((a, b) => TEST_CASES.findIndex(t => t.name === a.name) - TEST_CASES.findIndex(t => t.name === b.name));

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];
  const byCat = new Map<string, Result[]>();
  for (const r of results) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category)!.push(r);
  }

  console.log('\n' + '='.repeat(100));
  console.log('FULL RESULTS');
  console.log('='.repeat(100));
  console.log('\n| # | Test Case | Category | Output Saved | Cost Saved | Direct | Zip |');
  console.log('|:-:|-----------|----------|------------:|-----------:|:------:|:---:|');
  results.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.name} | ${r.category} | ${r.zip.outputCompressionRatio}% | ${r.zip.savingsPct}% | ${r.quality.directScore} | ${r.quality.zipScore} |`);
  });

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgOut = avg(results.map(r => r.zip.outputCompressionRatio));
  const avgCost = avg(results.map(r => r.zip.savingsPct));
  const avgD = avg(results.map(r => r.quality.directScore));
  const avgZ = avg(results.map(r => r.quality.zipScore));
  const totalSaved = results.reduce((s, r) => s + r.zip.savingsUSD, 0);

  console.log(`| | **Average** | | **${avgOut.toFixed(1)}%** | **${avgCost.toFixed(1)}%** | **${avgD.toFixed(1)}** | **${avgZ.toFixed(1)}** |`);

  console.log('\n\nCATEGORY SUMMARY');
  console.log('| Category | Cases | Avg Output Saved | Avg Cost Saved | Avg Direct | Avg Zip |');
  console.log('|----------|------:|-----------------:|---------------:|-----------:|--------:|');
  for (const cat of categories) {
    const cr = byCat.get(cat)!;
    console.log(`| ${cat} | ${cr.length} | ${avg(cr.map(r => r.zip.outputCompressionRatio)).toFixed(1)}% | ${avg(cr.map(r => r.zip.savingsPct)).toFixed(1)}% | ${avg(cr.map(r => r.quality.directScore)).toFixed(1)} | ${avg(cr.map(r => r.quality.zipScore)).toFixed(1)} |`);
  }
  console.log(`| **All** | **${results.length}** | **${avgOut.toFixed(1)}%** | **${avgCost.toFixed(1)}%** | **${avgD.toFixed(1)}** | **${avgZ.toFixed(1)}** |`);
  console.log(`\nTotal USD saved across all tests: $${totalSaved.toFixed(4)}`);

  console.log('\n--- RAW JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error('Benchmark failed:', err); process.exit(1); });
