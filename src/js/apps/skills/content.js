/** Skills window content. */
export function render() {
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
