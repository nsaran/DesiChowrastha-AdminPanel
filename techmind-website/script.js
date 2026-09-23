/* TechMind Software Solutions — site interactions */

// Current year in footer
(function () {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
})();

// Mobile nav toggle
(function () {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
    });

    // Close the menu after clicking a link (mobile)
    links.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
})();

// Scroll reveal for cards / sections
(function () {
    const revealTargets = document.querySelectorAll(
        '.card, .feature, .project, .about-stat, .section-head, .contact-form, .contact-info'
    );
    revealTargets.forEach(function (el) { el.classList.add('reveal'); });

    if (!('IntersectionObserver' in window)) {
        revealTargets.forEach(function (el) { el.classList.add('in'); });
        return;
    }

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    revealTargets.forEach(function (el) { observer.observe(el); });
})();

/**
 * Contact form handler.
 * This is a static site with no backend, so it opens the visitor's email client
 * pre-filled with their message, addressed to the business inbox. To capture
 * submissions server-side instead, point this at a form endpoint (e.g. Formspree,
 * Web3Forms, an Azure Function, or your own API).
 */
function handleContactSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const topic = form.topic.value;
    const message = form.message.value.trim();
    const note = document.getElementById('formNote');

    const to = 'hr@techminds.solutions';
    const subject = encodeURIComponent(`[${topic}] Inquiry from ${name}`);
    const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nInterested in: ${topic}\n\n${message}`
    );

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    if (note) note.textContent = 'Opening your email app… if nothing happens, email us directly at ' + to;
    return false;
}
