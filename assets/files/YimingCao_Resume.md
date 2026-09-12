# YIMING CAO

Vancouver, BC, Canada | (250) 514-2580 | caoyimingeric@gmail.com
[yimingcao-eric.github.io/portfolio](https://yimingcao-eric.github.io/portfolio/index.html) | [linkedin.com/in/yiming-cao-a760841b0](https://linkedin.com/in/yiming-cao-a760841b0) | [github.com/YimingCao-Eric](https://github.com/YimingCao-Eric)

---

## TECHNICAL SKILLS

| | |
|---|---|
| **Languages** | Python, Go, TypeScript / JavaScript, Java, SQL |
| **Backend & APIs** | FastAPI, async SQLAlchemy, Alembic, Pydantic, Go Fiber, GORM, Spring Boot, REST API design, JWT auth & RBAC, service-layer architecture |
| **Data Engineering** | GeoPandas / Shapely, NetworkX, PostgreSQL / PostGIS, MySQL, MongoDB Atlas, Redis, schema & ERD design, data contracts between services, canonical tables, schema migrations, data validation frameworks |
| **LLM & AI Workflows** | HuggingFace, OpenAI API, RAG, vector search, prompt engineering & prefix caching, rule-first LLM pipelines (deterministic filters before model calls), LLM evaluation, Claude Code, spec-driven development (GitHub Spec Kit) |
| **Deep Learning** | PyTorch, NumPy, SciPy, CNN backbones, diffusion models, knowledge distillation, few-shot learning, image forensics & quality metrics, Slurm (Compute Canada) |
| **Frontend** | React 19, TypeScript, TanStack Query, Redux, React Router, Tailwind CSS, streaming chat UIs |
| **Cloud, DevOps & Testing** | Pytest, JUnit / Mockito, Postman, AWS (Elastic Beanstalk, EC2, CloudWatch), Docker Compose, Git / GitHub PR workflow, soak testing, security review |

---

## EXPERIENCE

### Software Engineer — Tomkulak Consortium (volunteer) | Jan 2026 – Present

*Critical-infrastructure system-modelling platform: 21 sectors, Vancouver Island MVP scaling to BC, Yukon and Alberta; built in three layers: data ingestion, system modelling, and visualization*
- Owned the system-modelling architecture: authored the ERD/object model (nine entities: components, candidate sites, scenario state, dependency links, configuration membership…), the rule separating source GIS fields from model-computed fields, and the versioned data contract between the ingestion layer and the modelling layer — the document the enrichment, configuration-generation and React visualization work was then built against, so modelling and frontend proceeded in parallel with ingestion instead of waiting on it.
- Built the dependency and constraint framework: eight relationship categories (direct, cross-sector, parent–child, proximity, corridor, redundancy, exclusion, prerequisite) as typed NetworkX edges plus feasibility rules (mandatory / optional / conditionally removable components, prerequisites, minimum redundancy) kept as revisable rules rather than hard-coded functions — the guard that stops the configuration generator from emitting invalid systems.
- Built the multi-objective scoring and ranking engine: six objectives (stakeholder alignment, geostrategic, economic, sustainability, resilience, CI performance) with configurable weightings, separate rankings for ‘keep all’, ‘keep most’, and ‘allow removals’ recommendation types, and explanation metadata naming the factors that drove each rank.
- Built the scenario framework: side-by-side comparison of 3+ configurations, sensitivity analysis over six variables (costs, approval and performance assumptions, weightings, retention constraints), and Pydantic-typed JSON result structures matched to the frontend's optimization and topology endpoints, so the frontend switches from mock to live data with one config change.
- Data ingestion layer: engineered the configuration-driven Python ingestion template adopted by all 21 sector pipelines (pluggable GDB / Shapefile / GPKG / ArcGIS readers, staging → transform → PostGIS load) and the validation framework (geometry validity, required fields, uniqueness, referential integrity) whose reports separate code bugs from data problems to send back to the GIS team.

### Software Engineer — NextTier, Covina, CA | Sept 2024 – Sept 2025

*Designed and built a client RAG chatbot from scratch — backend, retrieval layer, UI, and AWS deployment*
- Built the Java Spring Boot backend exposing REST APIs for message flow, chat history, session state, and context-aware tone adjustment, using a service-layer pattern over MongoDB.
- Implemented the RAG retrieval layer — OpenAI text-embedding-3 queries with k-NN vector search on MongoDB Atlas — grounding GPT-4o responses in the client's verified domain corpus with targeted prompt engineering; enriched the knowledge base from HuggingFace datasets.
- Delivered a React + Tailwind CSS chat interface with end-to-end token streaming (OpenAI → Spring Boot → React), input throttling, and conversational context retention, iterated over 4 months of client feedback.
- Reached 100% test coverage with JUnit and Mockito; deployed to AWS Elastic Beanstalk (EC2) with MongoDB Atlas, autoscaling, and CloudWatch monitoring of latency and error rates.

---

## PROJECTS

### Job Hunting Assistant: a multi-site job scraper with an LLM matching pipeline | Mar 2026 – Present

*Solo · Python, FastAPI, async SQLAlchemy, Alembic, PostgreSQL, Redis, Chrome Extension (MV3), React 19, TypeScript, OpenAI API, Docker Compose*
- Designed and built an end-to-end platform that ingests semi-structured data from three heterogeneous web sources into a FastAPI/PostgreSQL backend, a React console, and a standalone LLM filter-and-match service — 1,306 records ingested in one unattended cycle.
- Designed a dual-write data model — per-source append-only tables plus a 27-column canonical table written atomically — with a projection layer enforcing fixed value sets, source-precedence rules and explicit unknown handling; evolved the schema through 31 Alembic migrations.
- Built filter-matcher, a service that encodes expert screening rules as cheap deterministic gates (user preferences, field completeness, hard-requirement filters, deduplication, keyword extraction, and a skills-coverage score) and sends only records with a mid-to-high coverage score to gpt-4o-mini; every run must account for every input record (shortlisted, excluded, or flagged) or is recorded as failed — 184 mocked tests.
- Reduced LLM cost by design: ~70% fewer input tokens via one-time condensation of each document to 120–200 words, prompts ordered for the provider's prefix caching, and zero model calls for records rejected by cheaper gates.
- Built an unattended orchestrator in a Chrome extension service worker; ran 10-hour soak tests and fixed the race conditions they exposed.
- Practised spec-driven development with GitHub Spec Kit and Claude Code across 11 feature specs; verifying each feature against live data caught three field-value mismatches (one affecting 28% of records) before release.

### E-Commerce Admin Platform — Go REST API and React dashboard | Nov 2025 – Dec 2025

*Solo · Go 1.25, Fiber v3, GORM, MySQL, JWT, bcrypt, React 19, TypeScript, Redux, React Router 7*
- Built a 28-route Go REST API (Fiber v3 + GORM/MySQL) and a 14-route React/TypeScript dashboard covering user, role, product and order management, image upload, CSV export and a daily-sales analytics chart.
- Implemented cookie-based authentication with HS256 JWTs in HTTP-only cookies, bcrypt (cost 14) password hashing, and role-based access control over a many-to-many role–permission model with per-method view_*/edit_* permission checks.
- Wrote a generic pagination layer through a Go Entity interface shared by users, products and orders, with eager-loaded order items and computed totals to avoid N+1 queries.
- Ported the codebase to current major versions (Fiber v3, React Router 7, React 19, Redux 5) and wrote a security review identifying hard-coded secrets, authorisation gaps, unsanitised upload filenames and float-based money as next fixes.

---

## RESEARCH PROJECTS — UNIVERSITY OF BRITISH COLUMBIA

### Detecting AI-generated images by their missing Bayer pattern — EECE 541 | Apr 2024

- Co-authored a training-free detector: re-mosaic under each of four Bayer layouts, demosaic, and use the spread of PSNRs as the test statistic; 97–100% detection on 46,000 generated images vs 999 camera RAWs, with 90% of real photographs retained.
- Ported Malvar–He–Cutler demosaicing and PSNR/SSIM/CIEDE2000 metrics to batched PyTorch for GPU throughput; compared six classifiers against a ResNet-50 baseline and built an in-browser version verified pixel-exact against the PyTorch code.

### Age-invariant face recognition by knowledge distillation — EECE 571L | Apr 2024

- Distilled a ResNet-100 ElasticFace teacher into ElasticFace and MTLFace students on B3FD, running 48-hour SLURM jobs on Compute Canada V100 GPUs across nine configurations; distillation lifted a weak student by 19.5 points on AgeDB (57.0% → 76.5%).

### Denoising Diffusion Probabilistic Models — EECE 501 | Dec 2023

- Initiated and led a three-person project; derived the DDPM training objective end to end and ran forward/reverse diffusion experiments with a noise-schedule comparison in PyTorch.

### Ensemble stacking on CIFAR-10 — EECE 571T | May 2023

- Trained LeNet, AlexNet, VGG and ResNet-18 as base learners plus a meta-network combining their predictions, evaluating every subset; the best three-model stack (88.7%) beat the best single model (85.6%) and included the weakest learner.

### Feature extractors for few-shot learning — EECE 570 | Apr 2023

- Trained ResNet-18, DenseNet-121 and ConvNeXt-T from scratch as backbones for Prototypical Networks on CUB-200 under one episodic protocol (DenseNet 83.8% > ResNet 81.8% > ConvNeXt 78.6%); ablated two prototype-head modifications.

### Denoising diffusion-weighted MRI — EECE 523 | Dec 2022

- Built block-DCT thresholding and PCA denoisers from scratch in NumPy with an evaluation pipeline over three subjects and four b-values; PCA gave ~5 dB SNR gain vs ~1.7 dB for DCT.

### Unsupervised brain-tumour segmentation — EECE 562 | Dec 2022

- Implemented Gaussian-mixture-model EM from scratch in PyTorch over ~nine million voxels per study on BraTS 2018; reached Dice ≈ 0.9 on six of ten patients without any labels.

---

## EDUCATION

### M.Eng., Electrical & Computer Engineering — University of British Columbia, Vancouver | Sept 2022 – May 2024

GPA 87% · Focus: deep learning, computer vision, generative models, medical image analysis

### B.Sc. (Honours), Computer Science & Mathematics — University of Victoria | Sept 2017 – May 2021

Graduated with distinction · GPA 7.53/9 · Honours thesis on off-policy reinforcement learning · Dean's List (2020)
