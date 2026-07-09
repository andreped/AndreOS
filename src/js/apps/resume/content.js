/** Resume window content. */
export function render() {
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
