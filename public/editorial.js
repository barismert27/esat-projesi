/* Public-site interactions. Content from the API is inserted as text. */
document.addEventListener('DOMContentLoaded', () => {
    // SVG keeps the diagonal arrow consistent on systems without symbol fonts.
    const decorateArrows = () => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: node => node.textContent.includes('↗') && !node.parentElement.closest('script, style, textarea, input') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const parts = node.textContent.split('↗');
            const fragment = document.createDocumentFragment();
            parts.forEach((part, index) => {
                fragment.append(document.createTextNode(part));
                if (index === parts.length - 1) return;
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('aria-hidden', 'true');
                svg.setAttribute('focusable', 'false');
                svg.classList.add('ed-arrow-icon');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M5 19 19 5M5 5h14v14');
                svg.append(path);
                fragment.append(svg);
            });
            node.replaceWith(fragment);
        });
    };
    decorateArrows();
    document.addEventListener('languagechange', decorateArrows);
    const currentLanguage = () => document.documentElement.lang || 'tr';
    const translate = key => window.translations?.[currentLanguage()]?.[key] || window.translations?.tr?.[key] || key;
    document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = new Date().getFullYear(); });

    // The existing script controls drawer visibility; add keyboard and focus behavior.
    const drawer = document.getElementById('mobile-drawer');
    const menu = document.getElementById('mobile-menu-btn');
    const closeMenu = document.getElementById('drawer-close-btn');
    const tabbable = root => [...root.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
    if (drawer && menu && closeMenu) {
        let wasOpen = false;
        const updateDrawer = () => {
            const open = drawer.classList.contains('open');
            drawer.inert = !open;
            menu.setAttribute('aria-expanded', String(open));
            if (open && !wasOpen) requestAnimationFrame(() => {
                if (drawer.classList.contains('open')) closeMenu.focus();
            });
            if (!open && wasOpen) menu.focus();
            wasOpen = open;
        };
        new MutationObserver(updateDrawer).observe(drawer, { attributes: true, attributeFilter: ['class'] });
        updateDrawer();
        document.addEventListener('keydown', event => {
            if (!drawer.classList.contains('open')) return;
            if (event.key === 'Escape') { event.preventDefault(); closeMenu.click(); }
            if (event.key !== 'Tab') return;
            const items = tabbable(drawer);
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (!drawer.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        // Match the responsive header breakpoint even on small tablets.
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1000 && drawer.classList.contains('open')) closeMenu.click();
        });
    }

    document.querySelectorAll('[data-open-dialog]').forEach(button => {
        button.addEventListener('click', () => {
            const dialog = document.getElementById(button.dataset.openDialog);
            if (!dialog) return;
            dialog.querySelector('.ed-form-status').textContent = '';
            dialog.showModal();
        });
    });
    document.querySelectorAll('.ed-dialog').forEach(dialog => {
        dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            const bounds = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
        });
    });

    // Keep the appointment privacy dialog usable with a keyboard as well.
    const privacy = document.getElementById('kvkk-modal');
    if (privacy) {
        let opener;
        const closePrivacy = document.getElementById('close-kvkk-modal');
        document.querySelectorAll('.open-kvkk-modal').forEach(button => button.addEventListener('click', () => {
            opener = button;
            closePrivacy?.focus();
        }));
        privacy.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); closePrivacy?.click(); }
            if (event.key === 'Tab') {
                const items = tabbable(privacy);
                if (!items.length) return;
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        new MutationObserver(() => {
            if (!privacy.classList.contains('active')) opener?.focus();
        }).observe(privacy, { attributes: true, attributeFilter: ['class'] });
    }

    const api = async (path, options) => {
        const response = await fetch('/api/' + path, options);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    };
    const faq = document.getElementById('ed-faq-list');
    if (faq) {
        api('faq/public').then(questions => {
            faq.replaceChildren();
            if (!questions.length) {
                const empty = document.createElement('p');
                empty.dataset.i18n = 'ed-faq-empty';
                empty.textContent = translate('ed-faq-empty');
                faq.append(empty);
            }
            questions.forEach(question => {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                const answer = document.createElement('p');
                summary.textContent = question.soru;
                answer.textContent = question.cevap;
                details.append(summary, answer);
                faq.append(details);
            });
        }).catch(() => {
            faq.replaceChildren();
            const error = document.createElement('p');
            error.dataset.i18n = 'ed-load-error';
            error.textContent = translate('ed-load-error');
            faq.append(error);
        });
    }

    const doctors = document.getElementById('ed-doctors-list');
    if (doctors) {
        api('doctors').then(result => {
            if (!result.success || !result.data?.length) return;
            result.data.forEach(doctor => {
                const card = document.createElement('article');
                const image = document.createElement('img');
                image.src = doctor.fotograf;
                image.alt = doctor.isim;
                image.loading = 'lazy';
                const name = document.createElement('h3');
                name.textContent = doctor.isim;
                const title = document.createElement('p');
                title.textContent = doctor.unvan;
                card.append(image, name, title);
                doctors.append(card);
            });
            document.getElementById('ed-doctors-section').hidden = false;
        }).catch(() => { /* A missing optional team list does not block the clinic page. */ });
    }

    const reviews = document.getElementById('ed-reviews');
    if (reviews) {
        api('reviews/public').then(items => {
            if (!items.length) return;
            let index = 0;
            const quote = document.createElement('blockquote');
            const text = document.createElement('p');
            const author = document.createElement('footer');
            quote.append(text, author);
            const showReview = () => {
                text.textContent = items[index].yorum;
                author.textContent = items[index].isim;
            };
            reviews.querySelector('.ed-feedback-note').remove();
            reviews.append(quote);
            if (items.length > 1) {
                const controls = document.createElement('div');
                controls.className = 'ed-review-nav';
                [-1, 1].forEach(direction => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = direction === -1 ? '←' : '→';
                    button.setAttribute('aria-label', translate(direction === -1 ? 'ed-prev-review' : 'ed-next-review'));
                    button.addEventListener('click', () => { index = (index + direction + items.length) % items.length; showReview(); });
                    controls.append(button);
                });
                reviews.append(controls);
            }
            showReview();
        }).catch(() => {
            const note = reviews.querySelector('.ed-feedback-note');
            note.dataset.i18n = 'ed-load-error';
            note.textContent = translate('ed-load-error');
        });
    }

    [['ed-question-form', 'faq', 'ed-question-success'], ['ed-review-form', 'reviews', 'ed-review-success']].forEach(([id, endpoint, successKey]) => {
        const form = document.getElementById(id);
        if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const button = form.querySelector('[type="submit"]');
            const status = form.querySelector('.ed-form-status');
            button.disabled = true;
            status.textContent = translate('ed-sending');
            try {
                const payload = Object.fromEntries(new FormData(form));
                await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                form.reset();
                status.textContent = translate(successKey);
            } catch {
                status.textContent = translate('ed-submit-error');
            } finally {
                button.disabled = false;
            }
        });
    });
});
