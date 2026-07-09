/** Projects window content. */
export function render() {
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
