# YIMING CAO

Vancouver, BC, Canada | (250) 514-2580 | caoyimingeric@gmail.com
[yimingcao-eric.github.io/portfolio](https://yimingcao-eric.github.io/portfolio/index.html) | [linkedin.com/in/yiming-cao-a760841b0](https://linkedin.com/in/yiming-cao-a760841b0) | [github.com/YimingCao-Eric](https://github.com/YimingCao-Eric)

---

## SUMMARY

Software engineer building LLM-powered applications and production data pipelines end to end across backend, frontend, and cloud — RAG systems, agentic and cost-gated LLM pipelines, geospatial data platforms, and spec-driven development with Claude Code central to the delivery workflow. M.Eng. (Electrical & Computer Engineering, UBC) and B.Sc. Honours (Computer Science & Mathematics, UVic), with research in diffusion models, medical-image denoising and segmentation, few-shot learning, ensemble methods, knowledge distillation, and AI-generated-image detection.

---

## TECHNICAL SKILLS

| | |
|---|---|
| **Languages** | Python, Java, Go, TypeScript / JavaScript, SQL |
| **LLM & GenAI Engineering** | OpenAI API, RAG, vector search, prompt engineering & prefix caching, cost-gated LLM pipelines, LLM evaluation, HuggingFace, Claude Code, spec-driven development (GitHub Spec Kit) |
| **Deep Learning & Computer Vision** | PyTorch, NumPy, SciPy, CNN backbones, diffusion models, knowledge distillation, few-shot learning, ensemble methods, unsupervised segmentation (GMM-EM, k-means), image denoising (DCT / PCA), image forensics & quality metrics, reinforcement learning, recommender systems |
| **Backend & APIs** | FastAPI, Spring Boot, Go Fiber, GORM, REST API design, async SQLAlchemy, Alembic, Pydantic, authentication & RBAC (JWT, bcrypt), service-layer architecture |
| **Databases & Data Modelling** | PostgreSQL / PostGIS, MySQL, MongoDB Atlas, Redis, schema & ERD design, data contracts, schema migrations, geospatial data (GeoPandas, Shapely, CRS reprojection), graph modelling (NetworkX) |
| **Frontend & Browser** | React, TypeScript, TanStack Query, Redux, React Router, Tailwind CSS, Bootstrap, Chrome Extensions (Manifest V3), streaming chat UIs |
| **Cloud, DevOps & HPC** | AWS (Elastic Beanstalk, EC2, CloudWatch), Docker Compose, Git / GitHub PR workflow, Slurm (Compute Canada), LaTeX |
| **Testing & Quality** | Pytest, JUnit, Mockito, Postman, ESLint / tsc gates, mocked & integration tests, soak testing, data validation frameworks, security review |

---

## WORK EXPERIENCE

### Software Engineer — Tomkulak Consortium (volunteer, part-time) | Jan 2026 – Present
*Critical-infrastructure system-modelling platform spanning 21 sectors across BC, Yukon, and Alberta; async Agile team with PR-based code review.*

- Engineered a configuration-driven Python ingestion template adopted by all 21 sector pipelines — cutting per-sector onboarding from days to hours — with pluggable readers (GDB, Shapefile, GPKG, ArcGIS) and standardized PostgreSQL + PostGIS loading with unified CRS reprojection via GeoPandas and Shapely.
- Shipped an automated validation framework (geometry validity, required fields, uniqueness, referential integrity) built on Pydantic and SQLAlchemy, with a dual-audience failure reporter separating code-side from upstream GIS-side issues, backed by Pytest unit and integration tests.
- Led system design of the Stage 2 core data model and ERD — nine modelling entities plus a versioned Stage 1 → Stage 2 data contract that let ingestion, modelling, and visualization teams develop independently.
- Built the dependency and scenario-analysis framework: eight relationship types modelled as typed edges in a NetworkX graph, powering side-by-side "what-if" runs with Pydantic-typed JSON outputs for the frontend.
- Set up the team's Git workflow for a multi-contributor Windows/PowerShell repository, resolving modify/delete and unrelated-history conflicts.

### Software Engineer — NextTier (Covina, CA) | Sept 2024 – Sept 2025
*Designed and built from scratch a music-focused RAG chatbot for a client, from backend and retrieval layer to UI and AWS deployment.*

- Built the Java Spring Boot backend exposing REST APIs for message flow, chat history, session state, and context-aware tone adjustment, using a service-layer pattern over MongoDB.
- Implemented the RAG retrieval layer — OpenAI text-embedding-3 queries with k-NN vector search on MongoDB Atlas Vector Search — grounding GPT-4o responses in the client's verified lyric and music corpus (trending artists, genres, releases) with targeted prompt engineering.
- Connected HuggingFace datasets to enrich the chatbot's contextual knowledge base using Python, enabling up-to-date music content retrieval and semantic similarity search across multiple data sources.
- Delivered a React + Tailwind CSS chat interface with end-to-end token streaming (OpenAI → Spring Boot → React), input throttling, and conversational context retention, iterated over 4 months of client feedback on UI/UX.
- Reached 100% test coverage with JUnit and Mockito mocking of OpenAI and MongoDB; published full API test results in Postman for client presentation.
- Deployed to AWS Elastic Beanstalk (EC2) with MongoDB Atlas, autoscaling, and CloudWatch monitoring of latency and error rates.

### Research Intern — Xi'an University of Posts and Telecommunications (Xi'an, China) | May 2023 – Aug 2023

- Researched the use of denoising diffusion models to generate directed acyclic graphs as architectures for deep neural networks (neural architecture search), collaborating with Dr. Chen Wei to develop research protocols.
- Conducted literature reviews, synthesized findings from multiple sources, and contributed to the code implementation.
- Prepared reports and presentations on research findings; participated in research meetings and seminars.

### Research Intern — Path Academics (Remote) | July 2020 – Aug 2020
*Research topic: Reinforcement-learning-based tracking for occlusion handling. Supervisor: Pietro Liò*

- Modelled the tracking problem mathematically, implemented the deep RL model in Python, analysed it against real-world scenarios, presented the results, and wrote the project report.

### Research Intern — Institute of Automation, Chinese Academy of Sciences (Beijing, China / Remote) | May 2020 – Aug 2020
*Research topic: Collaborative filtering algorithms in recommendation systems. Supervisor: Yiqiang Sheng*

- Modelled collaborative-filtering approaches mathematically, implemented them in Python, evaluated them on real-world data, presented findings, and wrote the project report.

---

## INDEPENDENT PROJECTS

### [Job Hunting Assistant](https://yimingcao-eric.github.io/portfolio/projects/job-hunting-assistant.html) — multi-site job scraper with an LLM matching pipeline | Mar 2026 – Present
*Solo · Python, FastAPI, async SQLAlchemy, Alembic, PostgreSQL, Redis, Chrome Extension (MV3), React 19, TypeScript, OpenAI API, Docker Compose*
Code: [github.com/YimingCao-Eric/job-hunting-assistant](https://github.com/YimingCao-Eric/job-hunting-assistant) · [github.com/YimingCao-Eric/filter-matcher](https://github.com/YimingCao-Eric/filter-matcher)

- Designed and built an end-to-end job-search platform: a Chrome extension that scrapes LinkedIn, Indeed and Glassdoor, a FastAPI/PostgreSQL backend, a React console, and a standalone LLM filter-and-match service — 1,306 postings ingested in one unattended cycle, 737 in a single verified three-site scan.
- Reverse-engineered three scraping surfaces (LinkedIn Voyager REST with cookie-derived CSRF, Indeed mosaic + GraphQL, Glassdoor `__NEXT_DATA__`/JSON-LD) and resolved a same-origin CORS defect that had zeroed all Glassdoor detail fetches.
- Designed a dual-write data model — per-site append-only tables plus a 27-column canonical table written atomically — with a pure-function projection layer enforcing closed vocabularies, precedence rules and NULL-means-unknown semantics; evolved the schema through 31 Alembic migrations.
- Built an unattended scraping orchestrator inside a Manifest V3 service worker that survives Chrome's worker suspension via backend-persisted state and `chrome.alarms`, with per-site session probes (CAPTCHA vs rate-limit classification), auto-pause on repeated failures, single-cycle guarantees and multi-instance detection.
- Ran 10-hour and 5-hour soak tests and fixed the failures they exposed from run logs — a never-cleared abort flag (254/255 cycles aborted), 403s misclassified as CAPTCHA, a 30-second race producing parallel cycles, and a stale-scan cleanup that mislabelled healthy 33-minute scans — reaching 8/9 cycles with zero attribution errors.
- Built filter-matcher, an on-demand Python service that claims postings with a one-way atomic flag flip, filters cheapest-first (preferences → completeness → field gates → dedup → CPU extraction → coverage banding) and sends only the ambiguous 0.50–1.00 coverage band to gpt-4o-mini; every run reconciles `claimed = shortlisted + excluded + anomalies` or is recorded as failed — 5 migrations, 184 mocked tests, 137/146 spec tasks complete.
- Reduced LLM cost by design: ~70% fewer input tokens via one-time 120–200-word JD standardisation, static-first prompts for provider prefix caching, CPU-only skill extraction, and zero model calls for postings rejected by cheaper gates.
- Rebuilt the frontend in React 19 + TypeScript + TanStack Query with a `tsc`/ESLint gate, a custom lint rule guarding consume-and-clear API routes, DOMPurify-sanitised descriptions and 135 unit tests.
- Practised spec-driven development with GitHub Spec Kit and Claude Code across 11 feature specs and two project constitutions; the newest spec carries 104 requirements, 25 success criteria and 43 recorded design decisions, with live-data verification gates that caught three vocabulary mismatches (e.g. `YEARLY` vs live `ANNUAL`, affecting 28% of salaried postings) before release.
- Diagnosed an ingest defect where reposts sharing a description hash returned HTTP 500 on 6–10% of LinkedIn ingests; the fix raised new jobs captured per scan from ~100 to ~240.

### [E-Commerce Admin Platform](https://yimingcao-eric.github.io/portfolio/projects/ecommerce-admin.html) — Go REST API and React dashboard | Nov 2025 – Dec 2025
*Solo, following and extending a Udemy course · Go 1.25, Fiber v3, GORM, MySQL, JWT, bcrypt, React 19, TypeScript, Redux, React Router 7, Bootstrap, c3.js*
Code: [github.com/YimingCao-Eric/go-admin](https://github.com/YimingCao-Eric/go-admin) · [github.com/YimingCao-Eric/react-admin](https://github.com/YimingCao-Eric/react-admin)

- Built a full-stack admin system for an online store — a 28-route Go REST API (Fiber v3 + GORM/MySQL) and a 14-route React/TypeScript dashboard — covering user, role, product and order management, image upload, CSV export and a daily-sales analytics chart.
- Implemented cookie-based authentication with HS256 JWTs in HTTP-only cookies, bcrypt (cost 14) password hashing, and role-based access control over a many-to-many role–permission model with per-method `view_*`/`edit_*` permission checks.
- Wrote a generic pagination layer through a Go `Entity` interface shared by users, products and orders, with eager-loaded order items and computed totals to avoid N+1 queries.
- Ported the course codebase to current major versions — Fiber v2→v3, React Router 5→7, React 19, Redux 5 — resolving each breaking change from the libraries' migration notes.
- Documented every handler and component, wrote both READMEs from scratch, and produced a written security review identifying hard-coded secrets, incomplete authorisation coverage, unsanitised upload filenames and float-based money as the next fixes.

---

## RESEARCH PROJECTS — UNIVERSITY OF BRITISH COLUMBIA

### [Detecting AI-generated images by their missing Bayer pattern](https://yimingcao-eric.github.io/portfolio/projects/bayer-fake-image-detection.html) — EECE 541 | Apr 2024
*Research paper + two talks · 4 authors · third author · work divided equally*

- Co-authored (equal split, four authors) a training-free method for detecting AI-generated images: re-mosaic an image under each of the four Bayer layouts, demosaic it again, and use the spread of the four PSNRs as the test statistic — camera photographs disagree across layouts, generated images do not.
- Evaluated on 999 RAISE camera RAWs against 46,000 generated images (DiffusionDB, GenImage's eight generators, 1,000 self-generated photoreal landscapes): 97–100% detection with 90% of real photographs retained.
- Ported Malvar–He–Cutler demosaicing and the PSNR/SSIM/CIEDE2000 metrics to batched PyTorch for GPU throughput; compared four demosaicing algorithms and six classifiers against a ResNet-50 baseline.
- Showed exactly where the method breaks — JPEG compression or resizing erases the pattern — and built an in-browser version of the test for the portfolio, verified pixel-exact against the team's PyTorch code.

### [Age-invariant face recognition by knowledge distillation](https://yimingcao-eric.github.io/portfolio/projects/age-invariant-face-recognition.html) — EECE 571L | Apr 2024
*Research paper + two talks · 3 authors · first author · responsible for the code and the evaluation*

- First author of a three-person paper on age-invariant face recognition; responsible for the code and the evaluation.
- Distilled a ResNet-100 ElasticFace teacher (trained on ten million MS1M images) into ElasticFace and MTLFace students on the age-labelled B3FD dataset, implementing the distillation losses and experiment scripts on a course-provided framework.
- Ran training as 48-hour SLURM jobs on Compute Canada V100 GPUs and evaluated nine configurations on B3FD, AgeDB and CASIA-WebFace.
- Distillation lifted a weak student by 19.5 points on AgeDB (57.0% → 76.5%); the best student (79.7%) did not clearly beat the purpose-built MTLFace baseline (77.4%) — both results reported and diagnosed in the paper.

### [Denoising Diffusion Probabilistic Models](https://yimingcao-eric.github.io/portfolio/projects/ddpm-diffusion-models.html) — EECE 501 | Dec 2023
*Research report + two talks · 3 authors · first author · initiated the project, chose the topic, did the derivation and the experiments*

- Initiated and led a three-person research project on denoising diffusion models (DDPM); first author of a 14-page LaTeX report with two accompanying talks.
- Derived the DDPM training objective end to end — from the maximum-likelihood bound through the KL decomposition to the closed-form noise-prediction loss — and wrote the report's mathematical core.
- Ran the experiments on forward and reverse diffusion, including a comparison of noise schedules, in a PyTorch/Colab notebook.
- Rebuilt the work as an interactive web page with a live forward-process simulator and the full derivation rendered in KaTeX.

### [Ensemble stacking on CIFAR-10](https://yimingcao-eric.github.io/portfolio/projects/ensemble-stacking.html) — EECE 571T | May 2023
*Research report + presentation · 2 authors · first author · initiated the project, chose the topic, built the implementation, ran the experiments*

- Initiated and led a two-person project on stacked ensembles of CNNs; first author, responsible for the implementation and the experiments.
- Trained LeNet, AlexNet, VGG and ResNet-18 as base learners on CIFAR-10 and a meta-network that learns to combine their predictions, evaluating every subset of base models.
- Found that the best three-model stack (88.7%) beat the best single model (85.6%) and included the weakest base learner (68%) — evidence that diversity, not individual strength, drives stacking gains.
- Built an interactive stacking playground for the portfolio that reproduces the effect on synthetic data.

### [Feature extractors for few-shot learning](https://yimingcao-eric.github.io/portfolio/projects/few-shot-learning.html) — EECE 570 | Apr 2023
*Solo research project · report + narrated video walkthrough*

- Solo project comparing convolutional backbones as feature extractors for Prototypical Networks on the CUB-200 fine-grained bird dataset.
- Trained ResNet-18, DenseNet-121 and ConvNeXt-T from scratch in PyTorch and evaluated them under the same episodic few-shot protocol: DenseNet 83.8% > ResNet 81.8% > ConvNeXt 78.6%.
- Designed and ablated two classifier-side modifications to the prototype head; both failed to improve accuracy, and the report explains why.
- Delivered the work as a written report plus a 4:45 narrated video walkthrough of the code and results.

### [Denoising diffusion-weighted MRI](https://yimingcao-eric.github.io/portfolio/projects/mri-denoising.html) — EECE 523 | Dec 2022
*Research paper + presentation · 5 authors · first author · principally responsible for the code*

- First author of a five-person research paper on denoising diffusion-weighted brain MRI; principally responsible for the implementation.
- Built two denoisers from scratch in NumPy — 8×8 block-DCT thresholding and PCA-based denoising — and a full evaluation pipeline over three subjects and four b-values.
- Measured a ~5 dB SNR gain for PCA against ~1.7 dB for DCT, and characterised the shared noise-vs-detail trade-off that limited both methods.
- Later reimplemented the DCT denoiser in JavaScript for the portfolio, verified against SciPy to four decimals, running live on a real DWI slice.

### [Unsupervised brain-tumour segmentation](https://yimingcao-eric.github.io/portfolio/projects/mri-segmentation.html) — EECE 562 | Dec 2022
*Research paper · 2 authors · second author · work divided equally*

- Co-authored a two-person paper on unsupervised brain-tumour segmentation on BraTS 2018, with the work split equally between the authors.
- Implemented Gaussian-mixture-model EM from scratch in PyTorch and ran it on the GPU over roughly nine million voxels per study, alongside a k-means baseline.
- Reached Dice ≈ 0.9 on six of ten patients without any labels, and analysed the failure cases where tumour and healthy tissue overlap in intensity.
- Built an interactive k-means-vs-GMM figure for the portfolio that runs both algorithms live on synthetic tissue data.

---

## EDUCATION

### University of British Columbia — Master of Engineering, Electrical & Computer Engineering | Sept 2022 – May 2024
*Vancouver, BC · GPA: 87%*

- Focus: deep learning, computer vision, generative models, medical image analysis.

### University of Victoria — Bachelor of Science (Honours), Computer Science & Mathematics | Sept 2017 – May 2021
*Victoria, BC · Graduated with distinction · GPA: 7.53/9*

- Honours thesis on off-policy reinforcement learning (supervisor: Nishant Mehta).
- Faculty of Science Dean's List (Oct 2020); International Student Scholarship (2017).
