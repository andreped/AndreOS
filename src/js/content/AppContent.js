/**
 * Pure HTML-string factories for every app window.
 * No DOM, no side effects — easy to test and update independently.
 *
 * Window configuration (title, size, kind) now lives in the App Registry
 * (`src/js/apps/`). `getWindowData()` is a thin adapter over it so existing
 * callers keep working.
 */
import { appRegistry } from '../apps/catalog/AppRegistry.js';

export function getAboutContent() {
    return `
        <div class="content-section">
            <h2>About Me</h2>
            <p>Hi, I'm André Pedersen! I'm passionate about building practical, real-world AI solutions that make a difference, particularly in healthcare. I currently work at DIPS AS in Oslo, Norway, where I develop AI-augmented software for the Norwegian healthcare system.</p>

            <h3>Background</h3>
            <p>I hold a PhD in Medical Technology focused on Artificial Intelligence for Computational Pathology from NTNU, Trondheim, and an MSc in Applied Physics and Mathematics (specializing in Machine Learning &amp; Statistics) from UiT: The Arctic University of Norway. Over eight years of experience in software engineering and applied machine learning have taken me from summer internships at SINTEF to leading production AI deployments used across Norwegian hospitals.</p>

            <h3>What I Do</h3>
            <ul>
                <li>End-to-end AI development — from model design and validation to scalable cloud deployment</li>
                <li>Generative AI &amp; large multimodal models for clinical applications</li>
                <li>Deep learning for medical imaging (segmentation, classification, registration)</li>
                <li>Fullstack development with React-TypeScript, .NET, and Python</li>
                <li>Cloud-native infrastructure on Azure with Docker, Kubernetes, and Argo CD</li>
                <li>Open-source software: CLI tools, Python packages, C++ desktop applications</li>
            </ul>

            <h3>Research</h3>
            <p>I have 30+ peer-reviewed publications, 500+ citations, and an h-index of 15. My research spans computational pathology, brain tumour segmentation, high-performance medical image computing, semi-supervised learning, and natural language processing. I have also co-supervised five Master's students and contributed technically to five PhD projects at NTNU.</p>
        </div>
    `;
}

export function getResumeContent() {
    return `
        <div class="content-section">
            <h2>Resume</h2>

            <h3>Experience</h3>

            <div style="margin-bottom: 20px;">
                <h4>Senior AI Engineer</h4>
                <p><strong>DIPS AS, Development</strong> | May 2025 – Present &nbsp;·&nbsp; Oslo, Norway</p>
                <ul>
                    <li>Augmenting healthcare software solutions with AI across Norwegian hospitals.</li>
                    <li>Launched <em>Pasientsamtale</em> into production at Western Norway RHF — speech-to-summary/schema at low latency with high accuracy.</li>
                    <li>Contributed to DIPS' first cloud-based application, DIPS AI, serving as the foundation for all AI solutions at DIPS.</li>
                    <li>Launched DIPS AI into production in two out of four Norwegian health regions.</li>
                    <li>Fullstack development with React-TypeScript, .NET, Python, Azure Speech/OpenAI/DevOps, Docker, Kubernetes, and Argo CD.</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Senior Machine Learning Engineer</h4>
                <p><strong>Sopra Steria, Applications</strong> | Oct. 2023 – May 2025 &nbsp;·&nbsp; Trondheim, Norway</p>
                <ul>
                    <li>Data scientist/engineer developing a chatbot for Equinor using Azure OpenAI, Vanna, Azure AI Search, React, and PostgreSQL.</li>
                    <li>Tech Lead on a research project with the UNICAN team at St. Olavs Hospital &amp; NTNU — no-code AI solutions for digital pathology.</li>
                    <li>Team Lead for an LLM-based prototype for environmental grading of buildings (Autility), managing three summer interns.</li>
                    <li>Contributed to open-source GenAI projects: Vanna (20k+ stars) and semantic-router (3k+ stars).</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Research Scientist</h4>
                <p><strong>SINTEF, Health Research</strong> | May 2022 – Nov. 2023 &nbsp;·&nbsp; Trondheim, Norway</p>
                <ul>
                    <li>Key contributor to FastPathology — an open-source C++/Qt5 platform for deep learning in digital pathology.</li>
                    <li>DevOps responsible for Raidionics — open clinical software for automatic brain tumour segmentation and clinical report generation.</li>
                    <li>Developed an open software plugin for cloud-based deployment of AI solutions for digital pathology.</li>
                    <li>Built 4 Gradio demo applications for AI-based medical 3D image segmentation hosted on Hugging Face Spaces.</li>
                    <li>Developed gradient-accumulator (Python/TensorFlow 2) and co-developed torchstain (PyTorch/TF/NumPy stain normalisation).</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Master of Science</h4>
                <p><strong>SINTEF, Health Research</strong> | Jan. 2019 – May 2022 &nbsp;·&nbsp; Trondheim, Norway</p>
                <ul>
                    <li>Led a SINTEF-funded project for code-free development and deployment of deep segmentation models for computational pathology.</li>
                    <li>Contributed to multiple funding applications; several achieved funding from the Norwegian Research Council.</li>
                    <li>Statistical analysis and method development for brain tumour MRI segmentation, NLP, and cancer treatment studies.</li>
                </ul>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>Summer Internship</h4>
                <p><strong>SINTEF, Health Research</strong> | Jun. 2018 – Aug. 2018 &nbsp;·&nbsp; Trondheim, Norway</p>
                <ul>
                    <li>Implemented algorithms and trained AI models for 3D semantic segmentation of medical volumetric CT data using TensorFlow.</li>
                </ul>
            </div>

            <h3>Education</h3>

            <div style="margin-bottom: 20px;">
                <h4>PhD in Medical Technology — AI for Computational Pathology</h4>
                <p><strong>Norwegian University of Science and Technology (NTNU)</strong> | Oct. 2019 – Oct. 2023 &nbsp;·&nbsp; Trondheim, Norway</p>
                <p>Defended Nov. 2024. Published 17 journal articles, 1 conference paper, and 1 book chapter during the thesis period.</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h4>MSc in Applied Physics and Mathematics — Machine Learning &amp; Statistics</h4>
                <p><strong>UiT: The Arctic University of Norway</strong> | Aug. 2014 – Jun. 2019 &nbsp;·&nbsp; Tromsø, Norway</p>
                <p>Industry project with SINTEF on AI for cancer diagnostics; contributed to a peer-reviewed journal publication.</p>
            </div>

            <h3>Selected Certifications</h3>
            <ul>
                <li><strong>Microsoft Certified: Azure AI Engineer Associate</strong> — Microsoft (May 2024)</li>
                <li><strong>Microsoft Certified: Azure Data Scientist Associate</strong> — Microsoft (May 2024)</li>
                <li><strong>Microsoft Certified: Azure Data Fundamentals</strong> — Microsoft (Jan. 2024)</li>
                <li><strong>Machine Learning in Production</strong> — DeepLearning.AI / Coursera (May 2024)</li>
                <li><strong>Generative AI with Large Language Models</strong> — DeepLearning.AI / Coursera (Jan. 2024)</li>
                <li><strong>TensorFlow Developer Certificate</strong> — Google (Jan. 2023)</li>
            </ul>

            <h3>Teaching</h3>
            <ul>
                <li><strong>Supervisor</strong> — NTNU/SINTEF (Jan. 2020 – Present): technical contributor to 5 PhD projects; (co-)supervisor of 5 MSc students in Computer Science.</li>
                <li><strong>Student Teaching Assistant</strong> — UiT (Aug. 2017 – Nov. 2018): led Python programming workshops for FYS-1001 (Mechanics) and FYS-2006 (Signal Processing).</li>
            </ul>
        </div>
    `;
}

export function getProjectsContent() {
    return `
        <div class="content-section">
            <h2>Projects</h2>
            <p>A selection of open-source and research projects I've built or significantly contributed to:</p>

            <div class="projects-grid">
                <div class="project-card">
                    <h4><a href="https://dips-ki.no/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">DIPS KI ↗</a></h4>
                    <p>DIPS' cloud-based AI platform (dips-ki.no), now live in two of four Norwegian health regions. Serves as the foundation for all AI solutions at DIPS.</p>
                    <div class="project-tech">
                        <span class="tech-tag">React-TypeScript</span>
                        <span class="tech-tag">.NET</span>
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">Azure Kubernetes Service</span>
                        <span class="tech-tag">Argo CD</span>
                        <span class="tech-tag">GitHub Actions</span>
                        <span class="tech-tag">GitOps</span>
                        <span class="tech-tag">Azure OpenAI</span>
                        <span class="tech-tag">Azure API Management</span>
                        <span class="tech-tag">PostgreSQL</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://www.linkedin.com/pulse/vi-introduserer-pasientsamtale-mer-tid-til-pasienten-det-som-betyr-phlbf/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">Pasientsamtale ↗</a></h4>
                    <p>Web app running inside DIPS Arena that converts clinical conversations to structured summaries and schemas. Launched at Western Norway RHF with low latency and high accuracy.</p>
                    <div class="project-tech">
                        <span class="tech-tag">React-TypeScript</span>
                        <span class="tech-tag">.NET</span>
                        <span class="tech-tag">Azure Speech</span>
                        <span class="tech-tag">Azure OpenAI</span>
                        <span class="tech-tag">Azure DevOps</span>
                        <span class="tech-tag">Argo CD</span>
                        <span class="tech-tag">Kubernetes</span>
                        <span class="tech-tag">GitOps</span>
                        <span class="tech-tag">PostgreSQL</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped/IronFlow" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">IronFlow ↗</a></h4>
                    <p>Cross-platform mobile app for private, offline strength training progress tracking. Logs exercises with weight, reps & sets in a local SQLite database, visualises progress over time, and notifies on new personal records. Available for Android & iOS.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Flutter</span>
                        <span class="tech-tag">Dart</span>
                        <span class="tech-tag">SQLite</span>
                        <span class="tech-tag">Android</span>
                        <span class="tech-tag">iOS</span>
                        <span class="tech-tag">GitHub Actions</span>
                        <span class="tech-tag">Maestro</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped/super-ml-pets" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">super-ml-pets ↗</a></h4>
                    <p>Framework for training and deploying reinforcement learning AIs for the game Super Auto Pets. Trains agents in a simulated environment via RL, then deploys them against real opponents using a machine vision system to read the live game screen.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">Reinforcement Learning</span>
                        <span class="tech-tag">Stable-Baselines3</span>
                        <span class="tech-tag">OpenCV</span>
                        <span class="tech-tag">scikit-learn</span>
                        <span class="tech-tag">PyAutoGUI</span>
                        <span class="tech-tag">GitHub Actions</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/AICAN-Research/FAST-Pathology" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">FastPathology ↗</a></h4>
                    <p>Open-source C++/Qt5 desktop platform for deep learning-based research and clinical decision support in digital pathology. Published in IEEE Access (2021).</p>
                    <div class="project-tech">
                        <span class="tech-tag">C++</span>
                        <span class="tech-tag">Qt5</span>
                        <span class="tech-tag">FAST</span>
                        <span class="tech-tag">Deep Learning</span>
                        <span class="tech-tag">Digital Pathology</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/raidionics/Raidionics" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">Raidionics ↗</a></h4>
                    <p>Open-source clinical software for automatic pre- and postoperative brain tumour segmentation and standardised clinical report generation. Actively maintained DevOps.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">Medical Imaging</span>
                        <span class="tech-tag">Segmentation</span>
                        <span class="tech-tag">CI/CD</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped/H2G-Net" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">H2G-Net ↗</a></h4>
                    <p>Multi-resolution cascaded CNN for breast cancer region segmentation in gigapixel histopathological whole slide images. Dice coefficient of 0.933 on independent test set. Published in Frontiers in Medicine (2022).</p>
                    <div class="project-tech">
                        <span class="tech-tag">PyTorch</span>
                        <span class="tech-tag">Computer Vision</span>
                        <span class="tech-tag">WSI Segmentation</span>
                        <span class="tech-tag">Deep Learning</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped/GradientAccumulator" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">gradient-accumulator ↗</a></h4>
                    <p>Python package enabling gradient accumulation in TensorFlow 2 — fills a key gap for training large models on limited GPU memory. Available on PyPI.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">TensorFlow 2</span>
                        <span class="tech-tag">Open Source</span>
                        <span class="tech-tag">PyPI</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/EIDOSLAB/torchstain" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">torchstain ↗</a></h4>
                    <p>Python package for rapid stain normalisation of histopathological images, supporting PyTorch, TensorFlow, and NumPy backends. Co-developed with EIDOS Lab.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">PyTorch</span>
                        <span class="tech-tag">TensorFlow</span>
                        <span class="tech-tag">Histopathology</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped/livermask" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">livermask ↗</a></h4>
                    <p>Open-source command-line tool for automatic liver segmentation from CT volumes using a pre-trained deep learning model.</p>
                    <div class="project-tech">
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">TensorFlow</span>
                        <span class="tech-tag">CT Segmentation</span>
                        <span class="tech-tag">CLI Tool</span>
                    </div>
                </div>

                <div class="project-card">
                    <h4><a href="https://github.com/andreped" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">Open-Source Contributions ↗</a></h4>
                    <p>Contributed to large community GenAI projects: Vanna (20k+ GitHub stars) — AI-powered SQL generation; semantic-router (3k+ stars) — semantic routing for LLM pipelines.</p>
                    <div class="project-tech">
                        <span class="tech-tag">GenAI</span>
                        <span class="tech-tag">LLM</span>
                        <span class="tech-tag">Python</span>
                        <span class="tech-tag">Open Source</span>
                    </div>
                </div>
            </div>

            <p style="margin-top:16px;">Full list of publications, datasets, and demos available at <a href="https://andreped.dev" target="_blank" style="color:var(--accent-primary)">andreped.dev</a> and <a href="https://github.com/andreped" target="_blank" style="color:var(--accent-primary)">github.com/andreped</a>.</p>
        </div>
    `;
}

export function getSkillsContent() {
    return `
        <div class="content-section">
            <h2>Technical Skills</h2>
            <p>Eight-plus years of hands-on experience across research, engineering, and production deployments.</p>

            <div class="skills-grid">
                <div class="skill-category">
                    <h4>Programming Languages</h4>
                    <ul>
                        <li>Python (primary)</li>
                        <li>C++ (Qt5, FAST)</li>
                        <li>C# / .NET</li>
                        <li>JavaScript / TypeScript</li>
                        <li>Dart</li>
                    </ul>
                </div>

                <div class="skill-category">
                    <h4>AI &amp; Machine Learning</h4>
                    <ul>
                        <li>Deep Learning (TensorFlow 2, PyTorch)</li>
                        <li>Computer Vision &amp; Medical Imaging</li>
                        <li>Generative AI &amp; Large Language Models</li>
                        <li>Semantic Segmentation &amp; Classification</li>
                        <li>Natural Language Processing</li>
                        <li>Semi-supervised &amp; Self-supervised Learning</li>
                    </ul>
                </div>

                <div class="skill-category">
                    <h4>Cloud &amp; Infrastructure</h4>
                    <ul>
                        <li>Microsoft Azure (OpenAI, Speech, AI Search, DevOps)</li>
                        <li>Docker &amp; Kubernetes</li>
                        <li>Argo CD (GitOps)</li>
                        <li>CI/CD Pipelines</li>
                        <li>GitHub Actions</li>
                    </ul>
                </div>

                <div class="skill-category">
                    <h4>Web &amp; Fullstack</h4>
                    <ul>
                        <li>React + TypeScript</li>
                        <li>ASP.NET / .NET</li>
                        <li>REST APIs</li>
                        <li>Gradio (ML demos)</li>
                        <li>PostgreSQL</li>
                    </ul>
                </div>

                <div class="skill-category">
                    <h4>Research &amp; Data</h4>
                    <ul>
                        <li>Statistical Analysis &amp; Experimental Design</li>
                        <li>Scientific Writing (30+ publications)</li>
                        <li>Peer Review (Medical Image Analysis, Nature Sci. Reports, …)</li>
                        <li>Grant Writing &amp; Funding Applications</li>
                        <li>PhD &amp; MSc Supervision</li>
                    </ul>
                </div>

                <div class="skill-category">
                    <h4>Tools &amp; Practices</h4>
                    <ul>
                        <li>Git &amp; GitHub</li>
                        <li>Azure OpenAI &amp; Vanna (RAG/SQL)</li>
                        <li>Hugging Face Spaces</li>
                        <li>Agile / Scrum</li>
                        <li>Open-source OSS development</li>
                    </ul>
                </div>
            </div>

            <div class="skills-section" style="margin-top:16px;">
                <h3>Microsoft Certifications</h3>
                <ul>
                    <li>Azure AI Engineer Associate (May 2024)</li>
                    <li>Azure Data Scientist Associate (May 2024)</li>
                    <li>Azure Data Fundamentals (Jan. 2024)</li>
                </ul>
            </div>
        </div>
    `;
}

export function getContactContent() {
    return `
        <div class="content-section">
            <h2>Contact</h2>
            <p>Feel free to reach out for collaborations, research discussions, or just to say hi. I'm most responsive via LinkedIn and email.</p>

            <div class="contact-info">
                <div class="contact-item">
                    <div class="contact-icon">📧</div>
                    <div class="contact-details">
                        <h4>Email</h4>
                        <p><a href="mailto:andrped94@gmail.com" style="color:inherit">andrped94@gmail.com</a></p>
                    </div>
                </div>

                <div class="contact-item">
                    <div class="contact-icon">📱</div>
                    <div class="contact-details">
                        <h4>Phone</h4>
                        <p>(+47) 955 24 208</p>
                    </div>
                </div>

                <div class="contact-item">
                    <div class="contact-icon">📍</div>
                    <div class="contact-details">
                        <h4>Location</h4>
                        <p>Oslo, Norway</p>
                    </div>
                </div>

                <div class="contact-item">
                    <div class="contact-icon">🌐</div>
                    <div class="contact-details">
                        <h4>Website</h4>
                        <p><a href="https://andreped.dev" target="_blank" style="color:inherit">andreped.dev</a></p>
                    </div>
                </div>
            </div>

            <h3>Let's Connect</h3>
            <p>Whether you're interested in AI for healthcare, open-source collaboration, or want to discuss research — I'd love to hear from you. I typically reply to emails within a day or two.</p>
        </div>
    `;
}

export function getSocialContent() {
    const icons = {
        github: `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
        linkedin: `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
        scholar: `<img src="/icons/scholar.svg" width="26" height="26" style="object-fit:contain" alt="Google Scholar">`,
        researchgate: `<img src="/icons/rg.svg" width="26" height="26" style="object-fit:contain" alt="ResearchGate">`,
        website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    };

    const mkIcon = (key, bg) =>
        `<div class="social-icon si-brand" style="background:${bg};color:#fff">${icons[key]}</div>`;

    return `
        <div class="content-section">
            <h2>Social &amp; Links</h2>
            <p>Find me across these platforms:</p>

            <div class="social-links">
                <a href="https://github.com/andreped" class="social-link" target="_blank">
                    ${mkIcon('github', '#24292e')}
                    <div class="social-details">
                        <h4>GitHub</h4>
                        <p>github.com/andreped</p>
                        <small>Open-source projects, tools, and research code</small>
                    </div>
                </a>

                <a href="https://www.linkedin.com/in/andr%C3%A9-pedersen" class="social-link" target="_blank">
                    ${mkIcon('linkedin', '#0A66C2')}
                    <div class="social-details">
                        <h4>LinkedIn</h4>
                        <p>linkedin.com/in/andré-pedersen</p>
                        <small>Professional updates and network</small>
                    </div>
                </a>

                <a href="https://scholar.google.com/citations?user=U20zUHQAAAAJ" class="social-link" target="_blank">
                    ${mkIcon('scholar', '#fff')}
                    <div class="social-details">
                        <h4>Google Scholar</h4>
                        <p>30+ publications · 500+ citations · h-index 15</p>
                        <small>Full publication list and citation metrics</small>
                    </div>
                </a>

                <a href="https://www.researchgate.net/profile/andre-pedersen/" class="social-link" target="_blank">
                    ${mkIcon('researchgate', '#fff')}
                    <div class="social-details">
                        <h4>ResearchGate</h4>
                        <p>researchgate.net/profile/andre-pedersen</p>
                        <small>Research profile and preprints</small>
                    </div>
                </a>

                <a href="https://andreped.dev" class="social-link" target="_blank">
                    ${mkIcon('website', '#6366f1')}
                    <div class="social-details">
                        <h4>Personal Website</h4>
                        <p>andreped.dev</p>
                        <small>News, demos, CV, and full research portfolio</small>
                    </div>
                </a>

                <a href="mailto:andrped94@gmail.com" class="social-link" target="_blank">
                    ${mkIcon('email', '#ff6b6b')}
                    <div class="social-details">
                        <h4>Email</h4>
                        <p>andrped94@gmail.com</p>
                        <small>Direct contact for opportunities and collaborations</small>
                    </div>
                </a>
            </div>
        </div>
    `;
}

export function getBrowserContent() {
    return `
        <div class="browser-chrome">
            <div class="browser-toolbar">
                <button class="nav-btn back-btn" title="Back">&#8592;</button>
                <button class="nav-btn fwd-btn" title="Forward">&#8594;</button>
                <button class="nav-btn reload-btn" title="Reload">&#8635;</button>
                <input class="url-bar" type="text" spellcheck="false" placeholder="Enter a URL or search...">
                <a class="nav-btn newtab-btn" href="#" target="_blank" rel="noopener noreferrer" title="Open in new tab">&#8599;</a>
            </div>
            <div class="browser-bookmarks">
                <button class="bm-chip" data-url="https://andreped.dev">&#127968; My Site</button>
                <button class="bm-chip" data-url="https://yep.com">&#128269; Yep</button>
                <button class="bm-chip" data-url="https://en.wikipedia.org/wiki/Artificial_intelligence">&#128218; Wikipedia</button>
                <button class="bm-chip" data-url="https://www.nettavisen.no">&#128240; Nettavisen</button>
                <button class="bm-chip" data-url="https://andreped-aeropath.hf.space">&#129978; AeroPath</button>
                <button class="bm-chip" data-url="https://andreped-lynos.hf.space">&#129704; LyNoS</button>
            </div>
            <div class="browser-viewport">
                <iframe class="browser-iframe"
                    credentialless
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerpolicy="no-referrer"></iframe>
                <div class="browser-blocked">
                    <div class="blocked-icon">&#128683;</div>
                    <p>This site doesn&#39;t allow embedding.</p>
                    <a class="blocked-newtab" href="#" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
                </div>
                <div class="browser-loading">
                    <div class="browser-spinner"></div>
                </div>
            </div>
        </div>
    `;
}

export function getChatContent() {
    return `
        <div class="chat-app">
            <div class="chat-load-overlay">
                <div class="chat-load-icon">⚙️</div>
                <div class="chat-load-title chat-model-name">AI Model</div>
                <div class="chat-load-subtitle">Compiling WebGPU shaders…<br><span style="opacity:0.5;font-size:11px">This takes ~30 s the first time, then weights are downloaded and cached.</span></div>
                <div class="chat-progress-track">
                    <div class="chat-progress-fill"></div>
                </div>
                <div class="chat-load-status">Initializing…</div>
            </div>
            <div class="chat-messages-area" style="display:none"></div>
            <div class="chat-input-row" style="display:none">
                <button class="chat-clear" data-tooltip="Clear conversation"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 3v1H4v2h1v13a2 2 0 002 2h10a2 2 0 002-2V6h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z"/></svg></button>
                <input class="chat-input" type="text" placeholder="Ask anything about André..." autocomplete="off" spellcheck="false">
                <button class="chat-send" data-tooltip="Send message"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
            </div>
        </div>
    `;
}

export function getSettingsContent() {
    const modelCards = [
        { id: 'SmolLM2-135M-Instruct-q0f16-MLC',      name: 'SmolLM2 135M',  size: '~265 MB', desc: 'Fastest load · English only',                          badge: null },
        { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',    name: 'Qwen2.5 1.5B',  size: '~1 GB',   desc: 'Multilingual · Norwegian ✓ · Best speed/quality balance', badge: 'Recommended' },
        { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',    name: 'Llama 3.2 1B',  size: '~800 MB', desc: 'Multilingual · Compact · Meta',                         badge: null },
        { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',    name: 'Llama 3.2 3B',  size: '~2 GB',   desc: 'Best response quality · Multilingual',                  badge: 'Best Quality' },
    ].map(m => `
        <div class="model-card" data-model-id="${m.id}">
            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
            <div class="model-card-info">
                <div class="model-card-header">
                    <span class="model-name">${m.name}</span>
                    ${m.badge ? `<span class="model-badge">${m.badge}</span>` : ''}
                    <span class="model-size">${m.size}</span>
                </div>
                <div class="model-desc">${m.desc}</div>
            </div>
        </div>`).join('');

    return `
        <div class="settings-container">
            <nav class="settings-sidebar">
                <div class="settings-sidebar-header">Settings</div>
                <div class="settings-nav-item active" data-section="ai">
                    <span class="settings-nav-icon">🤖</span><span>AI Engine</span>
                </div>
                <div class="settings-nav-item" data-section="voice">
                    <span class="settings-nav-icon">🎙️</span><span>Speech</span>
                </div>
            </nav>
            <div class="settings-content-panel">

                <div class="settings-section active" data-section="ai">
                    <h2 class="settings-section-title">AI Engine</h2>
                    <p class="settings-section-desc">Powers Ask André chat and the AI voice command parser. The model is downloaded once and cached in your browser.</p>
                    <div class="model-cards">${modelCards}</div>

                    <h3 class="settings-subsection-title">Response Language</h3>
                    <div class="lang-pills" id="llm-lang-pills">
                        <button class="lang-pill" data-lang="auto">Auto (match user)</button>
                        <button class="lang-pill" data-lang="en">English</button>
                        <button class="lang-pill" data-lang="no">Norwegian</button>
                    </div>

                    <div class="settings-apply-row">
                        <span class="settings-apply-status"></span>
                        <button class="settings-apply-btn">Save Settings</button>
                    </div>
                </div>

                <div class="settings-section" data-section="voice">
                    <h2 class="settings-section-title">Speech</h2>
                    <p class="settings-section-desc">Configure the speech recognition model and language for voice commands.</p>

                    <h3 class="settings-subsection-title">Transcription Model</h3>
                    <div class="model-cards">
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-tiny">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Tiny</span><span class="model-size">~39 MB</span></div>
                                <div class="model-desc">Fastest · Multilingual · Lower accuracy</div>
                            </div>
                        </div>
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-base">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Base</span><span class="model-badge">Recommended</span><span class="model-size">~74 MB</span></div>
                                <div class="model-desc">Recommended · Multilingual · Good balance</div>
                            </div>
                        </div>
                        <div class="model-card" data-whisper-model-id="Xenova/whisper-small">
                            <div class="model-card-radio"><span class="model-radio-dot"></span></div>
                            <div class="model-card-info">
                                <div class="model-card-header"><span class="model-name">Whisper Small</span><span class="model-badge">Best Quality</span><span class="model-size">~244 MB</span></div>
                                <div class="model-desc">Best accuracy · Multilingual · Slower load</div>
                            </div>
                        </div>
                    </div>

                    <h3 class="settings-subsection-title">Transcription Language</h3>
                    <div class="lang-pills" id="transcribe-lang-pills">
                        <button class="lang-pill" data-lang="auto">Auto-detect</button>
                        <button class="lang-pill" data-lang="english">English</button>
                        <button class="lang-pill" data-lang="norwegian">Norwegian</button>
                    </div>

                    <div class="settings-option">
                        <div class="settings-option-info">
                            <div class="settings-option-label">AI command parsing</div>
                            <div class="settings-option-desc">Use the AI model to interpret voice commands not matched by the built-in parser. Requires the AI model to be loaded first.</div>
                        </div>
                        <label class="settings-switch">
                            <input type="checkbox" id="voice-ai-toggle">
                            <span class="settings-switch-track"></span>
                        </label>
                    </div>

                    <div class="settings-apply-row">
                        <span class="settings-apply-status" id="voice-apply-status"></span>
                        <button class="settings-apply-btn" id="voice-apply-btn">Apply Voice Settings</button>
                    </div>
                </div>

            </div>
        </div>
    `;
}

export function getIronFlowContent() {
    return `
        <div class="game-viewport">
            <iframe class="ironflow-iframe"
                src="https://ironflow-bfo.pages.dev/"
                credentialless
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                referrerpolicy="no-referrer"></iframe>
            <div class="browser-blocked ironflow-blocked">
                <div class="blocked-icon">&#128683;</div>
                <p>IronFlow couldn&#39;t load — the server may not allow embedding.</p>
                <a class="blocked-newtab" href="https://ironflow-bfo.pages.dev/" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
            </div>
            <div class="browser-loading">
                <div class="browser-spinner"></div>
            </div>
        </div>
    `;
}

export function getGameContent() {
    return `
        <div class="game-viewport">
            <iframe class="game-iframe"
                src="https://cast-arena-io.onrender.com/"
                credentialless
                allow="accelerometer; autoplay; clipboard-write; fullscreen; gamepad; pointer-lock"
                referrerpolicy="no-referrer"></iframe>
            <div class="browser-blocked game-blocked">
                <div class="blocked-icon">&#128683;</div>
                <p>Game couldn't load — the server may not allow embedding.</p>
                <a class="blocked-newtab" href="https://cast-arena-io.onrender.com/" target="_blank" rel="noopener noreferrer">Open in new tab &#8599;</a>
            </div>
            <div class="browser-loading">
                <div class="browser-spinner"></div>
            </div>
        </div>
    `;
}

export function getResearchContent() {
    return `
        <div class="research-root">
            <div class="research-status">
                <div class="research-loading">
                    <div class="research-spinner"></div>
                    <p>Loading publications&hellip;</p>
                </div>
            </div>
            <div class="research-body research-split" style="display:none;">
                <div class="research-pane research-pane--list">
                    <div class="research-stats"></div>
                    <div class="research-toolbar">
                        <input type="search" class="research-search" placeholder="Search publications&hellip;" />
                        <select class="research-sort">
                            <option value="cited">Most cited</option>
                            <option value="date">Newest first</option>
                            <option value="asc">Oldest first</option>
                        </select>
                    </div>
                    <div class="research-filters"></div>
                    <div class="research-list"></div>
                </div>
                <div class="research-pane research-pane--detail">
                    <div class="research-detail-empty">
                        <div class="research-detail-empty-icon">📄</div>
                        <p>Select a publication to read it here.</p>
                    </div>
                    <div class="research-detail" hidden>
                        <div class="research-detail-header">
                            <div class="research-detail-title"></div>
                            <div class="research-detail-tabs">
                                <button class="research-tab active" data-view="pdf">PDF</button>
                                <button class="research-tab" data-view="abstract">Abstract</button>
                            </div>
                            <div class="research-detail-actions">
                                <a class="research-detail-link research-detail-doi" target="_blank" rel="noopener noreferrer" hidden>DOI ↗</a>
                                <a class="research-detail-link research-detail-newtab" target="_blank" rel="noopener noreferrer" hidden>Open ↗</a>
                            </div>
                        </div>
                        <div class="research-detail-viewer">
                            <div class="research-pdf-loading">
                                <div class="research-spinner"></div>
                                <p>Loading paper&hellip;</p>
                            </div>
                            <div class="research-pdf-canvas"></div>
                            <div class="research-pdf-blocked" hidden>
                                <div class="research-pdf-blocked-icon">🔒</div>
                                <p>This publisher doesn't allow reading the PDF inside the app.</p>
                                <a class="research-pdf-blocked-link" target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
                            </div>
                            <div class="research-pdf-none" hidden>
                                <div class="research-pdf-blocked-icon">🚫</div>
                                <p>No open-access PDF is available — showing the abstract instead.</p>
                            </div>
                            <div class="research-abstract-view" hidden>
                                <div class="research-abstract-meta"></div>
                                <div class="research-abstract-text"></div>
                            </div>
                            <div class="research-pdf-zoom" hidden>
                                <button class="research-zoom-out" title="Zoom out">−</button>
                                <span class="research-zoom-level">100%</span>
                                <button class="research-zoom-in" title="Zoom in">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Returns the window configuration object for a given file type, or null if
 * unknown. Delegates to the App Registry — the single source of truth for app
 * identity and window specs.
 */
export function getWindowData(fileType) {
    return appRegistry.toWindowData(fileType);
}
