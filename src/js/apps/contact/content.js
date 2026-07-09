/** Contact window content. */
export function render() {
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
